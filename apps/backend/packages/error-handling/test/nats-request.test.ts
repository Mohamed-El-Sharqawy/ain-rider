import { describe, expect, test, vi } from 'vitest';
import type { NatsConnection, Msg } from 'nats';
import type { Logger } from 'pino';
import { AppError, createNatsRequest, DEFAULT_NATS_TIMEOUT, serializeError, ValidationError } from '../src';

function stubLogger() {
  return { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as Logger & {
    error: ReturnType<typeof vi.fn>;
  };
}

function msgFor(payload: unknown): Msg {
  return { data: new TextEncoder().encode(JSON.stringify(payload)) } as Msg;
}

function connectionFor(handler: (subject: string, data: Buffer, timeout?: number) => Promise<Msg>) {
  const request = vi.fn((subject: string, data: Uint8Array, opts: { timeout: number }) =>
    handler(subject, Buffer.from(data), opts.timeout),
  );
  return { nc: { request } as unknown as NatsConnection, request };
}

const options = { traceId: '11111111-1111-4111-8111-111111111111', logger: stubLogger() };

describe('createNatsRequest', () => {
  test('returns the decoded response and sends the payload as JSON', async () => {
    const { nc, request } = connectionFor(async (subject) => {
      expect(subject).toBe('trip.get');
      return msgFor({ trip: { id: 7, status: 'ACTIVE' } });
    });

    const result = await createNatsRequest<{ trip: { id: number } }>(nc, 'trip.get', { id: 7 }, options);

    expect(result).toEqual({ trip: { id: 7, status: 'ACTIVE' } });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'trip.get',
      Buffer.from(JSON.stringify({ id: 7 })),
      { timeout: DEFAULT_NATS_TIMEOUT },
    );
  });

  test('uses the caller-provided timeout', async () => {
    const { nc, request } = connectionFor(async () => msgFor({ ok: true }));

    await createNatsRequest(nc, 'svc.do', null, { ...options, timeout: 250 });

    expect(request.mock.calls[0][2]).toEqual({ timeout: 250 });
  });

  test('throws the deserialized AppError when the responder replied with one', async () => {
    const original = new ValidationError('invalid phone', { field: 'phone' });
    const { nc } = connectionFor(async () => {
      const raw = serializeError(original);
      return { data: new TextEncoder().encode(raw) } as Msg;
    });

    const failure = await createNatsRequest(nc, 'svc.do', {}, options).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppError);
    expect(failure).not.toHaveProperty('code', 'SERVICE_UNAVAILABLE');
    expect((failure as AppError).code).toBe('VALIDATION_ERROR');
    expect((failure as AppError).httpStatus).toBe(400);
    expect((failure as AppError).details).toEqual({ field: 'phone' });
  });

  test.each([
    ['message variant', new Error('request timed out: TIMEOUT'), 'Service temporarily unavailable'],
    ['code variant', Object.assign(new Error('nats failure'), { code: 'TIMEOUT' }), 'Service temporarily unavailable'],
  ])('maps NATS timeouts to ServiceUnavailableError (%s)', async (_name, thrown, expectedMessage) => {
    const { nc } = connectionFor(async () => {
      throw thrown;
    });
    const logger = stubLogger();

    const failure = await createNatsRequest(nc, 'svc.do', {}, { ...options, logger }).catch((e: unknown) => e);

    expect(failure).toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: expectedMessage });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        errorType: 'NATS_TIMEOUT',
        traceId: options.traceId,
        subject: 'svc.do',
      }),
      expect.any(String),
    );
  });

  test('maps no-responders to ServiceUnavailableError', async () => {
    const { nc } = connectionFor(async () => {
      throw Object.assign(new Error('no responders available for request'), { code: 'NO_RESPONDERS' });
    });
    const logger = stubLogger();

    const failure = await createNatsRequest(nc, 'svc.do', {}, { ...options, logger }).catch((e: unknown) => e);

    expect(failure).toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: 'Service not available' });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ errorType: 'NATS_NO_RESPONDERS', subject: 'svc.do' }),
      expect.any(String),
    );
  });

  test('wraps unexpected transport failures', async () => {
    const { nc } = connectionFor(async () => {
      throw new Error('connection closed');
    });

    const failure = await createNatsRequest(nc, 'svc.do', {}, options).catch((e: unknown) => e);

    expect(failure).toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: 'Request failed' });
  });
});
