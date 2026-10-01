/**
 * Shared cross-cutting units: InternalAuthGuard, GlobalExceptionFilter,
 * TraceInterceptor and the NATS error serializer.
 */
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UnauthorizedError, ValidationError } from '@ain-rider/error-handling';
import { InternalAuthGuard } from '../src/shared/guards/internal-auth.guard';
import { GlobalExceptionFilter } from '../src/shared/filters/global-exception.filter';
import { TraceInterceptor } from '../src/shared/interceptors/trace.interceptor';
import { handleNatsError } from '../src/shared/nats/nats-error.handler';

describe('InternalAuthGuard', () => {
  const jwt = { verifyAsync: vi.fn() };
  const config = { get: vi.fn().mockReturnValue('secret') };
  const guard = new InternalAuthGuard(jwt as any, config as any);

  function context(headers: Record<string, string> = {}) {
    const request: any = { headers };
    return { switchToHttp: () => ({ getRequest: () => request }), request };
  }

  it('rejects a request with no authorization header', async () => {
    await expect(guard.canActivate(context() as any)).rejects.toThrow(
      new UnauthorizedException('Internal service auth header missing'),
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects non-bearer auth schemes', async () => {
    await expect(guard.canActivate(context({ authorization: 'Basic abc' }) as any)).rejects.toThrow(
      new UnauthorizedException('Invalid internal service auth format'),
    );
  });

  it('rejects a bearer header without a token', async () => {
    await expect(guard.canActivate(context({ authorization: 'Bearer' }) as any)).rejects.toThrow(
      new UnauthorizedException('Invalid internal service auth format'),
    );
  });

  it('rejects tokens that fail verification', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

    await expect(
      guard.canActivate(context({ authorization: 'Bearer garbage' }) as any),
    ).rejects.toThrow(new UnauthorizedException('Invalid internal service token'));
    expect(jwt.verifyAsync).toHaveBeenCalledWith('garbage', { secret: 'secret' });
  });

  it('stringifies non-Error verification failures when logging', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    jwt.verifyAsync.mockRejectedValue('jwt expired');

    await expect(
      guard.canActivate(context({ authorization: 'Bearer stale' }) as any),
    ).rejects.toThrow(new UnauthorizedException('Invalid internal service token'));
    expect(errorSpy).toHaveBeenCalledWith('[InternalAuthGuard] Error:', 'jwt expired');
  });

  it('rejects verified tokens without the internal claim', async () => {
    jwt.verifyAsync.mockResolvedValue({ internal: false, service: 'auth-service' });

    await expect(
      guard.canActivate(context({ authorization: 'Bearer token' }) as any),
    ).rejects.toThrow(new UnauthorizedException('Invalid internal service token'));
  });

  it('accepts a valid internal token and attaches the service to the request', async () => {
    jwt.verifyAsync.mockResolvedValue({ internal: true, service: 'admin-service' });
    const ctx = context({ authorization: 'Bearer good' });

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect(ctx.request.service).toBe('admin-service');
  });
});

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  function httpHost(request: Record<string, unknown>) {
    const response = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    };
    return { host: host as any, response };
  }

  it('maps an HttpException to its AppError envelope on http', () => {
    const { host, response } = httpHost({ traceId: 'trace-1', url: '/trips', method: 'POST' });

    filter.catch(new BadRequestException('bad input'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'bad input',
          traceId: 'trace-1',
        }),
      }),
    );
  });

  it('wraps unexpected errors into a 500 internal error envelope', () => {
    const { host, response } = httpHost({ traceId: 'trace-2', url: '/trips', method: 'PATCH' });

    filter.catch(new Error('kaboom'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.send.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('kaboom');
    expect(body.error.traceId).toBe('trace-2');
  });

  it('falls back to traceId unknown when the request has none', () => {
    const { host, response } = httpHost({ url: '/trips', method: 'GET' });

    filter.catch(new Error('x'), host);

    expect(response.send.mock.calls[0][0].error.traceId).toBe('unknown');
  });

  it('returns the serialized envelope on the rpc context', () => {
    const host = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => ({ traceId: 'trace-rpc' }) }),
    } as any;

    const reply = filter.catch(new Error('nats handler failed'), host);

    expect(reply).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'nats handler failed', traceId: 'trace-rpc' },
    });
  });

  it('uses traceId unknown when the rpc context carries none', () => {
    const host = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => undefined }),
    } as any;

    const reply = filter.catch(new UnauthorizedError('nope'), host);

    expect(reply).toMatchObject({ error: { code: 'UNAUTHORIZED', traceId: 'unknown' } });
  });

  it('handles unknown context types with the fallback envelope', () => {
    const host = { getType: () => 'ws' } as any;

    const reply = filter.catch(new ValidationError('ws error'), host);

    expect(reply).toMatchObject({ error: { code: 'VALIDATION_ERROR', traceId: 'unknown' } });
  });
});

describe('TraceInterceptor', () => {
  const interceptor = new TraceInterceptor();
  const next = { handle: () => 'handled' as any };

  function httpContext(headers: Record<string, string>) {
    const request: any = { headers };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request }),
    };
    return { context: context as any, request };
  }

  it('reuses an incoming x-trace-id and stamps it on the request', () => {
    const { context, request } = httpContext({ 'x-trace-id': 'incoming-1' });

    const result = interceptor.intercept(context, next);

    expect(result).toBe('handled');
    expect(request.traceId).toBe('incoming-1');
  });

  it('also honours the X-Trace-Id capitalisation', () => {
    const { request } = httpContext({ 'X-Trace-Id': 'incoming-2' });
    interceptor.intercept(contextWith(request), next);
    expect(request.traceId).toBe('incoming-2');
  });

  it('generates a trace id when the request has none', () => {
    const { request } = httpContext({});

    interceptor.intercept(contextWith(request), next);

    expect(request.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rpc: prefers the X-Trace-Id header from the nats message', () => {
    const headers = new Map([['X-Trace-Id', 'rpc-header']]);
    const contextObj: any = { getHeaders: () => headers };
    const context = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => contextObj }),
    } as any;

    interceptor.intercept(context, next);

    expect(contextObj.traceId).toBe('rpc-header');
  });

  it('rpc: falls back to a context-level traceId', () => {
    const contextObj: any = { traceId: 'rpc-prop' };
    const context = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => contextObj }),
    } as any;

    interceptor.intercept(context, next);

    expect(contextObj.traceId).toBe('rpc-prop');
  });

  it('rpc: generates a trace id when the context is bare', () => {
    const contextObj: any = {};
    const context = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => contextObj }),
    } as any;

    interceptor.intercept(context, next);

    expect(contextObj.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rpc: leaves a missing context untouched and still returns the stream', () => {
    const context = {
      getType: () => 'rpc',
      switchToRpc: () => ({ getContext: () => null }),
    } as any;

    expect(interceptor.intercept(context, next)).toBe('handled');
  });

  it('passes non-http/rpc contexts through untouched', () => {
    const context = { getType: () => 'ws' } as any;

    expect(interceptor.intercept(context, next)).toBe('handled');
  });
});

function contextWith(request: any): any {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('handleNatsError', () => {
  it('serializes an AppError with the trace id for the nats reply', () => {
    const reply = handleNatsError(new ValidationError('bad payload', { field: 'x' }), 'trace-9');

    expect(JSON.parse(reply)).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bad payload',
        traceId: 'trace-9',
        details: { field: 'x' },
      },
    });
  });
});
