import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { MetricsInterceptor } from '../../src/nestjs/interceptors/metrics.interceptor';
import { httpRequestDuration, httpRequestsTotal } from '../../src';

function httpContext(
  request: Record<string, unknown>,
  response: Record<string, unknown> = { statusCode: 200 },
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function nonHttpContext(): ExecutionContext {
  return { getType: () => 'rpc' } as unknown as ExecutionContext;
}

describe('MetricsInterceptor', () => {
  let inc: ReturnType<typeof vi.spyOn>;
  let observe: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    MetricsInterceptor.setServiceName('auth-service');
    inc = vi.spyOn(httpRequestsTotal, 'inc').mockReturnValue(undefined);
    observe = vi.spyOn(httpRequestDuration, 'observe').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('setServiceName stores the service used in metric labels', async () => {
    const interceptor = new MetricsInterceptor();

    const result = await firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', route: { path: '/users' } }),
        { handle: () => of('payload') } as unknown as CallHandler,
      ),
    );

    expect(result).toBe('payload');
    expect(inc.mock.calls[0][0]).toMatchObject({ service: 'auth-service' });
  });

  test('passes non-http contexts through without recording metrics', async () => {
    const interceptor = new MetricsInterceptor();

    const result = await firstValueFrom(
      interceptor.intercept(nonHttpContext(), { handle: () => of('value') } as unknown as CallHandler),
    );

    expect(result).toBe('value');
    expect(inc).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });

  test('records count and duration in seconds on success', async () => {
    const interceptor = new MetricsInterceptor();

    const result = await firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'POST', route: { path: '/rides' } }, { statusCode: 201 }),
        { handle: () => of('created') } as unknown as CallHandler,
      ),
    );

    expect(result).toBe('created');
    expect(inc).toHaveBeenCalledExactlyOnceWith({
      service: 'auth-service',
      method: 'POST',
      route: '/rides',
      status_code: '201',
    });
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'auth-service', method: 'POST', route: '/rides', status_code: '201' },
      expect.any(Number),
    );
    expect(observe.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
  });

  test.each([
    ['uses the router path when available', { method: 'GET', route: { path: '/drivers' }, originalUrl: '/ignored' }, '/drivers'],
    ['falls back to originalUrl without a route', { method: 'GET', originalUrl: '/fallback' }, '/fallback'],
    ['falls back to unknown without route or url', { method: 'GET' }, 'unknown'],
  ])('%s', (_name, request, expectedRoute) => {
    const interceptor = new MetricsInterceptor();

    void firstValueFrom(
      interceptor.intercept(
        httpContext(request as Record<string, unknown>),
        { handle: () => of('ok') } as unknown as CallHandler,
      ),
    );

    expect(inc.mock.calls[0][0]).toMatchObject({ route: expectedRoute });
  });

  test('defaults the status code to 200 when the response carries none', () => {
    const interceptor = new MetricsInterceptor();

    void firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', route: { path: '/health' } }, {}),
        { handle: () => of('ok') } as unknown as CallHandler,
      ),
    );

    expect(inc.mock.calls[0][0]).toMatchObject({ status_code: '200' });
  });

  test('records metrics with the error status on failures and rethrows', async () => {
    const interceptor = new MetricsInterceptor();
    const failure = Object.assign(new Error('too many'), { status: 429 });

    await expect(
      firstValueFrom(
        interceptor.intercept(
          httpContext({ method: 'GET', route: { path: '/rides' } }),
          { handle: () => throwError(() => failure) } as unknown as CallHandler,
        ),
      ),
    ).rejects.toBe(failure);

    expect(inc).toHaveBeenCalledExactlyOnceWith({
      service: 'auth-service',
      method: 'GET',
      route: '/rides',
      status_code: '429',
    });
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'auth-service', method: 'GET', route: '/rides', status_code: '429' },
      expect.any(Number),
    );
  });

  test('falls back to statusCode then 500 for errors without a status', () => {
    const interceptor = new MetricsInterceptor();

    void firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', route: { path: '/a' } }),
        {
          handle: () => throwError(() => Object.assign(new Error('forbidden'), { statusCode: 403 })),
        } as unknown as CallHandler,
      ),
    ).catch(() => undefined);
    void firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', route: { path: '/b' } }),
        { handle: () => throwError(() => new Error('boom')) } as unknown as CallHandler,
      ),
    ).catch(() => undefined);
    void firstValueFrom(
      interceptor.intercept(
        httpContext({ method: 'GET', route: { path: '/c' } }),
        { handle: () => throwError(() => 'plain failure') } as unknown as CallHandler,
      ),
    ).catch(() => undefined);

    expect(inc.mock.calls.map((call) => (call[0] as { status_code: string }).status_code)).toEqual([
      '403',
      '500',
      '500',
    ]);
  });
});
