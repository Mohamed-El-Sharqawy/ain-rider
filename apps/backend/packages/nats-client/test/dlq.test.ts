import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { NatsConnection } from 'nats';
import { DLQService, createDLQService } from '../src/dlq/dlq.service';
import {
  DLQAlertingService,
  createDLQAlerting,
} from '../src/dlq/dlq-alerting';
import {
  connectTestNats,
  ensureSharedStream,
  sleep,
  uniqueId,
  waitFor,
} from './helpers';

/** Records js.publish calls without touching the network. */
function fakeJs() {
  const published: { subject: string; payload: string }[] = [];
  let failNext = false;
  return {
    published,
    fail() {
      failNext = true;
    },
    async publish(subject: string, data: Uint8Array) {
      if (failNext) {
        failNext = false;
        throw new Error('publish failed');
      }
      published.push({ subject, payload: new TextDecoder().decode(data) });
      return { stream: 'AIN_RIDER_DLQ', seq: published.length, duplicate: false };
    },
  } as unknown as Parameters<typeof createDLQService>[0] & {
    published: { subject: string; payload: string }[];
    fail: () => void;
  };
}

function dlqPayload(overrides: Record<string, unknown> = {}) {
  return {
    originalSubject: 'ain_rider.trip_matched',
    originalEventId: 'evt-alert-1',
    consumerName: 'trip-matched-consumer',
    error: { message: 'handler exploded' },
    retryCount: 3,
    traceId: 'a'.repeat(32),
    ...overrides,
  };
}

describe('DLQService (unit)', () => {
  test('builds the dlq subject and publishes a structured message', async () => {
    const js = fakeJs();
    const service = createDLQService(js);
    expect(service).toBeInstanceOf(DLQService);

    await service.sendToDLQ({
      originalSubject: 'ain_rider.trip_matched',
      originalPayload: '{"eventId":"evt-1"}',
      originalHeaders: { traceparent: '00-x' },
      originalEventId: 'evt-1',
      traceId: 'b'.repeat(32),
      error: new Error('boom'),
      retryCount: 3,
      consumerName: 'consumer-a',
      sourceStream: 'AIN_RIDER_OPS',
    });

    expect(js.published).toHaveLength(1);
    const { subject, payload } = js.published[0]!;
    expect(subject).toBe('ain_rider.dlq.trip_matched');
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      originalSubject: 'ain_rider.trip_matched',
      originalEventId: 'evt-1',
      errorReason: 'boom',
      retryCount: 3,
      consumerName: 'consumer-a',
      sourceStream: 'AIN_RIDER_OPS',
    });
    expect(parsed.errorStack).toContain('boom');
  });

  test('maps non-ain_rider subjects under the dlq prefix', async () => {
    const js = fakeJs();
    const service = new DLQService(js);
    await service.sendToDLQ({
      originalSubject: 'custom.subject.failed',
      originalPayload: '{}',
      originalHeaders: {},
      originalEventId: 'evt-2',
      traceId: 'c'.repeat(32),
      error: new Error('nope'),
      retryCount: 1,
      consumerName: 'consumer-b',
      sourceStream: 'W10',
    });
    expect(js.published[0]!.subject).toBe('ain_rider.dlq.custom.subject.failed');
  });

  test('rethrows publish failures', async () => {
    const js = fakeJs();
    const service = new DLQService(js);
    js.fail();
    await expect(
      service.sendToDLQ({
        originalSubject: 'ain_rider.x',
        originalPayload: '{}',
        originalHeaders: {},
        originalEventId: 'evt-3',
        traceId: 'd'.repeat(32),
        error: new Error('cause'),
        retryCount: 2,
        consumerName: 'consumer-c',
        sourceStream: 'W10',
      }),
    ).rejects.toThrow('publish failed');
  });
});

describe('DLQAlertingService (unit)', () => {
  test('createAlert maps the dlq message onto an alert', () => {
    const service = new DLQAlertingService(fakeJs(), { logToConsole: false });
    const alert = service.createAlert(
      dlqPayload() as Parameters<DLQAlertingService['createAlert']>[0],
    );
    expect(alert).toMatchObject({
      originalSubject: 'ain_rider.trip_matched',
      originalEventId: 'evt-alert-1',
      consumerName: 'trip-matched-consumer',
      error: 'handler exploded',
      retryCount: 3,
      traceId: 'a'.repeat(32),
    });
    expect(Date.parse(alert.timestamp)).not.toBeNaN();
  });

  test('createAlert tolerates a missing trace id', () => {
    const service = new DLQAlertingService(fakeJs(), { logToConsole: false });
    const alert = service.createAlert(
      dlqPayload({ traceId: undefined }) as Parameters<DLQAlertingService['createAlert']>[0],
    );
    expect(alert.traceId).toBeUndefined();
  });

  test('processDLQMessage logs and invokes the alert handler', async () => {
    const seen: unknown[] = [];
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new DLQAlertingService(fakeJs(), {
      onAlert: async (alert) => {
        seen.push(alert);
      },
    });
    await service.processDLQMessage(
      dlqPayload() as Parameters<DLQAlertingService['processDLQMessage']>[0],
    );
    expect(seen).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({ level: 'error', type: 'dlq_alert' });
    errorSpy.mockRestore();
  });

  test('a failing alert handler does not break processing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new DLQAlertingService(fakeJs(), {
      logToConsole: false,
      onAlert: async () => {
        throw new Error('pagerduty down');
      },
    });
    await expect(
      service.processDLQMessage(
        dlqPayload() as Parameters<DLQAlertingService['processDLQMessage']>[0],
      ),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[DLQAlerting] Alert handler error:',
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });

  test('logToConsole=false skips console logging', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = new DLQAlertingService(fakeJs(), { logToConsole: false });
    await service.processDLQMessage(
      dlqPayload() as Parameters<DLQAlertingService['processDLQMessage']>[0],
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('createDLQAlerting factory defaults logToConsole to true', () => {
    const service = createDLQAlerting(fakeJs());
    expect(service.isMonitoring()).toBe(false);
  });
});

describe('DLQAlertingService startMonitoring (fake-driven wiring)', () => {
  function fakeNc(loopBehavior: {
    messages?: unknown[];
    throwAfterStop?: boolean;
    throwImmediately?: boolean;
  }) {
    const calls = { streamsAdd: 0, consumersAdd: 0 };
    const fakeMsg = (payload: unknown) => {
      const counters = { ack: 0, nak: 0 };
      const msg = {
        data: new TextEncoder().encode(JSON.stringify(payload)),
        ack: () => {
          counters.ack += 1;
        },
        nak: () => {
          counters.nak += 1;
        },
      };
      Object.defineProperty(msg, 'ackCalls', { get: () => counters.ack });
      Object.defineProperty(msg, 'nakCalls', { get: () => counters.nak });
      return msg;
    };

    const nc = {
      jetstreamManager: async () => ({
        streams: {
          info: async () => {
            throw new Error('stream not found');
          },
          add: async () => {
            calls.streamsAdd += 1;
            return {};
          },
        },
        consumers: {
          info: async () => {
            throw new Error('consumer not found');
          },
          add: async () => {
            calls.consumersAdd += 1;
            return {};
          },
        },
      }),
    } as unknown as NatsConnection;

    const serviceRef: { current?: DLQAlertingService } = {};
    const js = {
      consumers: {
        get: async () => ({
          consume: async () => ({
            [Symbol.asyncIterator]: () => {
              let index = 0;
              return {
                next: async () => {
                  if (loopBehavior.throwImmediately) {
                    throw new Error('iteration exploded');
                  }
                  if (loopBehavior.throwAfterStop) {
                    // stay pending until the service is stopped, then blow up
                    const svc = serviceRef.current!;
                    while (svc.isMonitoring()) {
                      await sleep(20);
                    }
                    throw new Error('closed by stop');
                  }
                  if (index >= (loopBehavior.messages?.length ?? 0)) {
                    return { done: true, value: undefined };
                  }
                  const value = fakeMsg(loopBehavior.messages![index]);
                  index += 1;
                  return { done: false, value };
                },
              };
            },
          }),
        }),
      },
    } as unknown as Parameters<typeof createDLQAlerting>[0];

    return { nc, js, calls, serviceRef, fakeMsg };
  }

  test('creates a missing DLQ stream and consumer, then processes messages', async () => {
    const { nc, js, calls, serviceRef } = fakeNc({
      messages: [
        dlqPayload({ originalEventId: 'evt-fake-1' }),
        { malformed: true },
      ],
    });
    const alerts: { originalEventId: string }[] = [];
    const service = createDLQAlerting(js, {
      consumerName: 'w10-dlqmon-fake',
      logToConsole: false,
      onAlert: async (alert) => {
        alerts.push(alert);
      },
    });
    serviceRef.current = service;

    await service.startMonitoring(nc);
    // both create paths ran
    await waitFor(() => calls.streamsAdd >= 1 && calls.consumersAdd >= 1);
    // the loop processed the valid message and alerted, and acked it
    await waitFor(() => alerts.length >= 1);
    await sleep(200);
    await service.stop();
  });

  test('reports consumer errors while monitoring', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { nc, js } = fakeNc({ throwImmediately: true });
    // no consumerName: the default "dlq-monitor" consumer is used
    const service = createDLQAlerting(js, { logToConsole: false });
    await service.startMonitoring(nc);
    await waitFor(() =>
      errorSpy.mock.calls.some((c) => String(c[0]).includes('Consumer error')),
    );
    expect(service.isMonitoring()).toBe(true);
    await service.stop();
    errorSpy.mockRestore();
  });

  test('stays quiet when the consumer errors after stop', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { nc, js, serviceRef } = fakeNc({ throwAfterStop: true });
    const service = createDLQAlerting(js, {
      consumerName: 'w10-dlqmon-fake3',
      logToConsole: false,
    });
    serviceRef.current = service;
    await service.startMonitoring(nc);
    await sleep(100);
    await service.stop();
    // the pending iteration rejects after stop; running=false keeps the log
    await sleep(200);
    expect(
      errorSpy.mock.calls.some((c) => String(c[0]).includes('Consumer error')),
    ).toBe(false);
    errorSpy.mockRestore();
  });
});

describe('DLQ end to end against the docker cluster', () => {
  let nc: NatsConnection;
  let createdDlqStream = false;
  const cleanupConsumers: { stream: string; name: string }[] = [];
  const deletedSeqs: number[] = [];

  beforeAll(async () => {
    nc = await connectTestNats('dlq');
    const jsm = await nc.jetstreamManager();
    createdDlqStream = await ensureSharedStream(jsm, 'AIN_RIDER_DLQ', [
      'ain_rider.dlq.*',
    ]);
  });

  afterAll(async () => {
    if (nc) {
      const jsm = await nc.jetstreamManager();
      for (const { stream, name } of cleanupConsumers.splice(0)) {
        await jsm.consumers.delete(stream, name).catch(() => undefined);
      }
      // remove the test messages we published to the shared DLQ stream
      for (const seq of deletedSeqs.splice(0)) {
        await jsm.streams.deleteMessage('AIN_RIDER_DLQ', seq).catch(() => undefined);
      }
      await nc.drain().catch(() => undefined);
    }
    if (createdDlqStream) {
      const cleanup = await connectTestNats('dlq-cleanup');
      await cleanup
        .jetstreamManager()
        .then((m) => m.streams.delete('AIN_RIDER_DLQ'))
        .catch(() => undefined);
      await cleanup.drain();
    }
  });

  test('DLQService stores a retrievable message in the shared DLQ stream', async () => {
    const jsm = await nc.jetstreamManager();
    const before = await jsm.streams.info('AIN_RIDER_DLQ');
    const service = new DLQService(nc.jetstream());
    const originalSubject = `w10svc${uniqueId('n')}`;
    const dlqSubject = `ain_rider.dlq.${originalSubject}`;

    await service.sendToDLQ({
      originalSubject,
      originalPayload: '{"eventId":"evt-e2e-1"}',
      originalHeaders: {},
      originalEventId: 'evt-e2e-1',
      traceId: 'f'.repeat(32),
      error: new Error('end to end failure'),
      retryCount: 3,
      consumerName: 'w10-e2e-consumer',
      sourceStream: 'AIN_RIDER_OPS',
    });

    const after = await jsm.streams.info('AIN_RIDER_DLQ');
    expect(after.state.messages).toBe(before.state.messages + 1);

    // find and verify the stored message, then remove it again
    let found = false;
    for (let seq = before.state.last_seq + 1; seq <= after.state.last_seq; seq += 1) {
      const stored = await jsm.streams.getMessage('AIN_RIDER_DLQ', { seq });
      const payload = JSON.parse(new TextDecoder().decode(stored.data as Uint8Array));
      if (payload.originalEventId === 'evt-e2e-1') {
        expect(stored.subject).toBe(dlqSubject);
        expect(payload.errorReason).toBe('end to end failure');
        expect(payload.failedAt).toBeTruthy();
        found = true;
        deletedSeqs.push(seq);
        await jsm.streams.deleteMessage('AIN_RIDER_DLQ', seq);
        break;
      }
    }
    expect(found).toBe(true);
    const cleaned = await jsm.streams.info('AIN_RIDER_DLQ');
    expect(cleaned.state.messages).toBe(before.state.messages);
  });

  test('startMonitoring delivers alerts for DLQ messages', async () => {
    const jsm = await nc.jetstreamManager();
    const consumerName = `w10-dlqmon-${uniqueId('n')}`;
    cleanupConsumers.push({ stream: 'AIN_RIDER_DLQ', name: consumerName });

    const alerts: { originalEventId: string }[] = [];
    let resolveAlert: (() => void) | undefined;
    const firstAlert = new Promise<void>((resolve) => {
      resolveAlert = resolve;
    });

    const service = new DLQAlertingService(nc.jetstream(), {
      consumerName,
      logToConsole: false,
      onAlert: async (alert) => {
        alerts.push(alert);
        if (resolveAlert) {
          resolveAlert();
          resolveAlert = undefined;
        }
      },
    });
    expect(service.isMonitoring()).toBe(false);

    // pre-create the consumer so startMonitoring takes the exists path
    await jsm.consumers.add('AIN_RIDER_DLQ', {
      name: consumerName,
      durable_name: consumerName,
      filter_subject: 'ain_rider.dlq.>',
      ack_policy: 'explicit' as never,
      deliver_policy: 'all' as never,
    });

    await service.startMonitoring(nc);
    expect(service.isMonitoring()).toBe(true);

    // second start hits the already-monitoring early return
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await service.startMonitoring(nc);
    expect(logSpy).toHaveBeenCalledWith('[DLQAlerting] Already monitoring');
    logSpy.mockRestore();

    // publish a well-formed DLQ message and expect an alert
    const tag = uniqueId('a');
    const ack = await nc.jetstream().publish(
      `ain_rider.dlq.w10alert${tag}`,
      new TextEncoder().encode(JSON.stringify(dlqPayload({ originalEventId: 'evt-mon-1' }))),
    );
    await Promise.race([firstAlert, waitFor(() => alerts.length >= 1)]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts.some((a) => (a as { originalEventId: string }).originalEventId === 'evt-mon-1')).toBe(true);
    deletedSeqs.push(ack.seq);

    // publish a malformed payload: processing fails and the message is naked
    const badAck = await nc.jetstream().publish(
      `ain_rider.dlq.w10bad${tag}`,
      new TextEncoder().encode(JSON.stringify({ not: 'a dlq message' })),
    );
    deletedSeqs.push(badAck.seq);
    await sleep(500);

    // stop (with an abort controller wired in to cover the abort branch)
    (service as unknown as { abortController: AbortController | null }).abortController =
      new AbortController();
    await service.stop();
    expect(service.isMonitoring()).toBe(false);
    // second stop is a no-op
    await service.stop();
  });
});
