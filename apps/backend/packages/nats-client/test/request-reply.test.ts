import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { NatsConnection, Subscription } from 'nats';
import {
  NatsRequestClient,
  createNatsRequestClient,
} from '../src/request-reply/request-client';
import {
  NatsResponder,
  createNatsResponder,
} from '../src/request-reply/responder';
import {
  NatsRequester,
  createRequester,
} from '../src/requester';
import {
  NatsResponder as LegacyNatsResponder,
  createResponder,
} from '../src/responder';
import {
  ServiceUnavailableError,
  createLogger,
  serializeError,
} from '@ain-rider/error-handling';
import { EnvSaver, connectTestNats, sleep, uniqueId } from './helpers';

describe('request-reply modern pair (integration)', () => {
  let nc: NatsConnection;
  const subscriptions: Subscription[] = [];

  const trackSubscription = (responder: NatsResponder): void => {
    const sub = (responder as unknown as { subscription: Subscription }).subscription;
    if (sub) subscriptions.push(sub);
  };

  beforeAll(async () => {
    nc = await connectTestNats('rr');
  });

  afterAll(async () => {
    if (nc) {
      await nc.drain().catch(() => undefined);
    }
  });

  function silentResponder(subject: string): void {
    const sub = nc.subscribe(subject);
    subscriptions.push(sub);
    void (async () => {
      for await (const msg of sub) {
        void msg; // receive but never reply
      }
    })().catch(() => undefined);
  }

  test('round-trips a request with tracing metadata', async () => {
    const subject = `w10.rr.${uniqueId('s')}.suspend`;
    const seen: { traceId?: string; requestedBy?: string; body: unknown }[] = [];
    const responder = createNatsResponder(nc, { subject, serviceName: 'user-service' });
    await responder.respond(async (request) => {
      seen.push({
        traceId: request.traceId,
        requestedBy: request.requestedBy,
        body: request.data,
      });
      return { userId: request.data.userId, status: 'SUSPENDED', suspendedAt: 'now' };
    });
    trackSubscription(responder);

    const client = createNatsRequestClient(nc);
    const traceId = 'a'.repeat(32);
    const response = await client.request<
      { userId: string },
      { userId: string; status: string }
    >(subject, { userId: 'u-1' }, { traceId, requestedBy: 'admin-service', timeout: 3000 });

    expect(response.status).toBe('SUSPENDED');
    await sleep(100);
    expect(seen[0]!.body).toEqual({ userId: 'u-1' });
    expect(seen[0]!.requestedBy).toBe('admin-service');
    expect(seen[0]!.traceId).toBe(traceId);
  });

  test('defaults trace id from generateTraceId and requestedBy from SERVICE_NAME', async () => {
    const env = new EnvSaver();
    try {
      env.set('SERVICE_NAME', 'env-service');
      const subject = `w10.rr.${uniqueId('s')}.defaults`;
      const seen: { traceId: string; requestedBy: string }[] = [];
      const responder = new NatsResponder(nc, { subject });
      await responder.respond(async (request) => {
        seen.push({ traceId: request.traceId, requestedBy: request.requestedBy });
        return { ok: true };
      });
      trackSubscription(responder);

      const client = new NatsRequestClient(nc);
      const response = await client.request<{ ok: boolean }, { ok: boolean }>(
        subject,
        { ping: true },
        { timeout: 3000 },
      );
      expect(response).toEqual({ ok: true });
      expect(seen[0]!.requestedBy).toBe('env-service');
      expect(seen[0]!.traceId).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      env.restore();
    }
  });

  test('uses "unknown" as requestedBy when SERVICE_NAME is unset', async () => {
    const env = new EnvSaver();
    try {
      env.set('SERVICE_NAME', undefined);
      const subject = `w10.rr.${uniqueId('s')}.unknown`;
      const seen: string[] = [];
      const responder = new NatsResponder(nc, { subject });
      await responder.respond(async (request) => {
        seen.push(request.requestedBy);
        return { ok: true };
      });
      trackSubscription(responder);
      await new NatsRequestClient(nc).request(subject, {}, { timeout: 3000 });
      expect(seen[0]).toBe('unknown');
    } finally {
      env.restore();
    }
  });

  test('surfaces handler errors with code and details', async () => {
    const subject = `w10.rr.${uniqueId('s')}.error`;
    const responder = new NatsResponder(nc, { subject });
    await responder.respond(async () => {
      const err = new Error('user is protected') as Error & {
        code?: string;
        details?: unknown;
      };
      err.code = 'PROTECTED_USER';
      err.details = { userId: 'u-9' };
      throw err;
    });
    trackSubscription(responder);

    const client = new NatsRequestClient(nc);
    const err = (await client.request(subject, {}).catch((e: Error) => e)) as Error & {
      code?: string;
      details?: unknown;
    };
    expect(err.message).toBe('user is protected');
    expect(err.code).toBe('PROTECTED_USER');
    expect(err.details).toEqual({ userId: 'u-9' });
  });

  test('handler errors without a code map to INTERNAL_ERROR', async () => {
    const subject = `w10.rr.${uniqueId('s')}.internal`;
    const responder = new NatsResponder(nc, { subject });
    await responder.respond(async () => {
      throw new Error('sneaky failure');
    });
    trackSubscription(responder);

    const client = new NatsRequestClient(nc);
    const err = (await client.request(subject, {}).catch((e: Error) => e)) as Error & {
      code?: string;
    };
    expect(err.message).toBe('sneaky failure');
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  test('messageless handler errors report "Unknown error"', async () => {
    const subject = `w10.rr.${uniqueId('s')}.messageless`;
    const responder = new NatsResponder(nc, { subject });
    await responder.respond(async () => {
      throw new Error();
    });
    trackSubscription(responder);

    const client = new NatsRequestClient(nc);
    const err = (await client.request(subject, {}).catch((e: Error) => e)) as Error & {
      code?: string;
    };
    expect(err.message).toBe('Unknown error');
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  test('times out when a responder never replies', async () => {
    const subject = `w10.rr.${uniqueId('s')}.silent`;
    silentResponder(subject);

    const client = new NatsRequestClient(nc);
    const err = (await client
      .request(subject, {}, { timeout: 250 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toContain(subject);
    expect(err.message).toContain('250ms');
  });

  test('maps responder error envelopes carrying NO_RESPONDERS', async () => {
    const subject = `w10.rr.${uniqueId('s')}.noresp`;
    const sub = nc.subscribe(subject);
    subscriptions.push(sub);
    void (async () => {
      for await (const msg of sub) {
        msg.respond(
          new TextEncoder().encode(
            JSON.stringify({
              success: false,
              traceId: 'x'.repeat(32),
              error: { code: 'NO_RESPONDERS', message: 'simulated' },
            }),
          ),
        );
      }
    })().catch(() => undefined);

    const client = new NatsRequestClient(nc);
    const err = (await client
      .request(subject, {}, { timeout: 2000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.code).toBe('NO_RESPONDERS');
    expect(err.message).toBe(`No service available at ${subject}`);
  });

  test('rethrows transport 503 no-responder errors as-is', async () => {
    const client = new NatsRequestClient(nc);
    const err = (await client
      .request(`w10.rr.${uniqueId('s')}.nobody`, {}, { timeout: 1000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.code).toBe('503');
  });

  test('stop() unsubscribes so later requests find no responder', async () => {
    const subject = `w10.rr.${uniqueId('s')}.stop`;
    const responder = new NatsResponder(nc, { subject });
    // stop before respond: the subscription guard is a no-op
    await responder.stop();

    await responder.respond(async () => ({ ok: true }));
    trackSubscription(responder);
    const client = new NatsRequestClient(nc);
    await expect(client.request(subject, {}, { timeout: 2000 })).resolves.toEqual({
      ok: true,
    });

    await responder.stop();
    const err = (await client
      .request(subject, {}, { timeout: 1000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.code).toBe('503');
  });

  test('responder loop reports errors when the subscription iterator fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // a connection whose subscription iterator rejects drives the
    // responder's safety-net catch without needing a real failure
    const fakeNc = {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(new Error('iterator exploded')),
        }),
        unsubscribe: () => undefined,
      }),
    } as unknown as NatsConnection;

    const responder = new NatsResponder(fakeNc, {
      subject: 'w10.rr.fake.destroy',
      serviceName: 'destroy-test',
    });
    await responder.respond(async () => ({ ok: true }));
    await sleep(200);
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('Responder loop error'))).toBe(
      true,
    );
    errorSpy.mockRestore();
  });
});

describe('legacy requester/responder (integration)', () => {
  let nc: NatsConnection;
  const subscriptions: Subscription[] = [];

  beforeAll(async () => {
    nc = await connectTestNats('rr-legacy');
  });

  afterAll(async () => {
    if (nc) {
      await nc.drain().catch(() => undefined);
    }
  });

  function rawResponder(
    subject: string,
    reply: () => string,
  ): void {
    const sub = nc.subscribe(subject);
    subscriptions.push(sub);
    void (async () => {
      for await (const msg of sub) {
        msg.respond(new TextEncoder().encode(reply()));
      }
    })().catch(() => undefined);
  }

  test('round-trips wrapped requests through the legacy responder', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.echo`;
    const responder = createResponder(nc);
    await responder.respond<{ echo: string }, { echo: string }>(
      subject,
      async (data) => ({ echo: data.echo }),
    );
    subscriptions.push(
      (responder as unknown as { subscriptions: Subscription[] }).subscriptions[0]!,
    );

    const requester = createRequester(nc);
    const response = await requester.request<{ echo: string }, { echo: string }>(
      subject,
      { data: { echo: 'hi' }, traceId: 'b'.repeat(32) },
      { timeout: 3000 },
    );
    expect(response).toEqual({ echo: 'hi' });
    await responder.close();
  });

  test('accepts raw (unwrapped) payloads', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.raw`;
    const responder = new LegacyNatsResponder(nc);
    const received: unknown[] = [];
    await responder.respond<Record<string, unknown>, { ok: boolean }>(
      subject,
      async (data) => {
        received.push(data);
        return { ok: true };
      },
    );
    subscriptions.push(
      (responder as unknown as { subscriptions: Subscription[] }).subscriptions[0]!,
    );

    const requester = new NatsRequester(nc);
    const response = await requester.request(subject, { raw: true }, { timeout: 3000 });
    expect(response).toEqual({ ok: true });
    expect(received[0]).toEqual({ raw: true });
    await responder.close();
  });

  test('falls back to the unknown trace id when the wrapper omits it', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.emptytrace`;
    const responder = new LegacyNatsResponder(nc);
    await responder.respond<{ v: number }, { v: number }>(
      subject,
      async (data) => ({ v: data.v }),
    );
    subscriptions.push(
      (responder as unknown as { subscriptions: Subscription[] }).subscriptions[0]!,
    );

    const requester = new NatsRequester(nc);
    // wrapped payload whose traceId is an empty string
    const response = await requester.request<{ v: number }, { v: number }>(
      subject,
      { data: { v: 7 }, traceId: '' },
      { timeout: 3000 },
    );
    expect(response).toEqual({ v: 7 });
    await responder.close();
  });

  test('maps failures without code or message to INTERNAL_ERROR', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.blank`;
    const responder = new LegacyNatsResponder(nc);
    await responder.respond(subject, async () => {
      throw new Error();
    });
    subscriptions.push(
      (responder as unknown as { subscriptions: Subscription[] }).subscriptions[0]!,
    );

    const requester = new NatsRequester(nc);
    const err = (await requester
      .request(subject, {}, { timeout: 3000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.message).toBe('Unknown error');
    expect(err.code).toBe('INTERNAL_ERROR');
    await responder.close();
  });

  test('surfaces handler errors with their code and trace id', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.err`;
    const responder = new LegacyNatsResponder(nc);
    await responder.respond(subject, async () => {
      const err = new Error('denied') as Error & { code?: string };
      err.code = 'NOT_ALLOWED';
      throw err;
    });
    subscriptions.push(
      (responder as unknown as { subscriptions: Subscription[] }).subscriptions[0]!,
    );

    const requester = new NatsRequester(nc);
    const err = (await requester
      .request(subject, { data: {}, traceId: 'c'.repeat(32) }, { timeout: 3000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.message).toBe('denied');
    expect(err.code).toBe('NOT_ALLOWED');
    await responder.close();
  });

  test('reconstructs serialized AppErrors preserving the code', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.apperror`;
    rawResponder(subject, () =>
      serializeError(new ServiceUnavailableError('downstream down')),
    );

    const requester = new NatsRequester(nc);
    const err = (await requester
      .request(subject, { ping: 1 }, { timeout: 3000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
    expect(err.message).toBe('downstream down');
  });

  test('maps NO_RESPONDERS-coded failures to ServiceUnavailableError', async () => {
    const errorCalls: [string, unknown][] = [];
    const logger = {
      error: (msg: string, ctx: unknown) => {
        errorCalls.push([msg, ctx]);
      },
    } as unknown as ReturnType<typeof createLogger>;

    const subject = `w10.lrr.${uniqueId('s')}.noresp`;
    const serialized = JSON.parse(
      serializeError(new ServiceUnavailableError('anything')),
    ) as { code: string };
    serialized.code = 'NO_RESPONDERS';
    rawResponder(subject, () => JSON.stringify(serialized));

    const requester = new NatsRequester(nc);
    const err = await requester
      .request(subject, {}, { timeout: 3000, logger, traceId: 'nr-1' })
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect(err.message).toBe(`Service at ${subject} is not available`);
    expect(errorCalls[0]![0]).toBe('NATS no responders');
    expect(errorCalls[0]![1]).toMatchObject({ subject, traceId: 'nr-1' });
  });

  test('applies the default timeout when no options are given', async () => {
    const requester = new NatsRequester(nc);
    const err = (await requester
      .request(`w10.lrr.${uniqueId('s')}.noopts`, {})
      .catch((e: Error) => e)) as Error & { code?: string };
    // no responder: the raw 503 bubbles up untouched
    expect(err.code).toBe('503');
  });

  test('throws the plain error field when present', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.legacyerr`;
    rawResponder(subject, () => JSON.stringify({ error: 'plain failure' }));

    const requester = new NatsRequester(nc);
    await expect(
      requester.request(subject, {}, { timeout: 3000 }),
    ).rejects.toThrow('plain failure');
  });

  test('surfaces structured error payloads with code and message', async () => {
    const requester = new NatsRequester(nc);

    // structured error with a message
    const subject = `w10.lrr.${uniqueId('s')}.struct`;
    rawResponder(
      subject,
      () => JSON.stringify({ error: { code: 'NOT_ALLOWED', message: 'denied' } }),
    );
    const err = (await requester
      .request(subject, {}, { timeout: 3000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.message).toBe('denied');
    expect(err.code).toBe('NOT_ALLOWED');

    // structured error without a message falls back
    const subject2 = `w10.lrr.${uniqueId('s')}.struct2`;
    rawResponder(subject2, () => JSON.stringify({ error: { code: 'MYSTERY' } }));
    const err2 = (await requester
      .request(subject2, {}, { timeout: 3000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err2.message).toBe('Unknown error');
    expect(err2.code).toBe('MYSTERY');
  });

  test('maps transport timeouts to ServiceUnavailableError', async () => {
    const subject = `w10.lrr.${uniqueId('s')}.silent`;
    const sub = nc.subscribe(subject);
    subscriptions.push(sub);
    void (async () => {
      for await (const msg of sub) {
        void msg; // never reply
      }
    })().catch(() => undefined);

    const requester = new NatsRequester(nc);
    const err = await requester
      .request(subject, {}, { timeout: 250 })
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect(err.message).toBe(
      `Service request to ${subject} timed out after 250ms`,
    );
  });

  test('rethrows unexpected transport errors untouched', async () => {
    const requester = new NatsRequester(nc);
    const err = (await requester
      .request(`w10.lrr.${uniqueId('s')}.nobody`, {}, { timeout: 1000 })
      .catch((e: Error) => e)) as Error & { code?: string };
    expect(err.code).toBe('503');
  });

  test('logs failures through an injected logger', async () => {
    const errorCalls: [string, unknown][] = [];
    const logger = {
      error: (msg: string, ctx: unknown) => {
        errorCalls.push([msg, ctx]);
      },
    } as unknown as ReturnType<typeof createLogger>;

    const requester = new NatsRequester(nc);
    const subject = `w10.lrr.${uniqueId('s')}.logged`;
    const sub = nc.subscribe(subject);
    subscriptions.push(sub);
    void (async () => {
      for await (const msg of sub) {
        void msg;
      }
    })().catch(() => undefined);

    await expect(
      requester.request(subject, {}, { timeout: 200, logger, traceId: 'log-1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    expect(errorCalls[0]![1]).toMatchObject({ subject, traceId: 'log-1' });
    sub.unsubscribe();
  });
});
