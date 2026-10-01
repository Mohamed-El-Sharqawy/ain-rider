import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { NatsConnection, JetStreamManager } from 'nats';
import {
  NatsPublisher,
  createPublisher,
} from '../src/publisher';
import {
  NatsConsumer,
  createConsumer,
} from '../src/consumer';
import {
  connectTestNats,
  createTestStream,
  deleteStreamQuietly,
  ensureSharedStream,
  sleep,
  uniqueId,
  waitFor,
} from './helpers';

describe('legacy NatsPublisher', () => {
  let nc: NatsConnection;
  let jsm: JetStreamManager;
  const tag = uniqueId('lp');
  const streamName = `W10_LP_${tag.toUpperCase()}`;
  const subjectBase = `w10.lp.${tag}`;

  beforeAll(async () => {
    nc = await connectTestNats('lp');
    jsm = await nc.jetstreamManager();
    await createTestStream(jsm, streamName, [`${subjectBase}.>`]);
  });

  afterAll(async () => {
    if (nc) {
      const cleanup = await connectTestNats('lp-cleanup');
      await deleteStreamQuietly(await cleanup.jetstreamManager(), streamName);
      await cleanup.drain();
      await nc.drain().catch(() => undefined);
    }
  });

  test('publishes the raw event data payload', async () => {
    const publisher = createPublisher(nc);
    expect(publisher).toBeInstanceOf(NatsPublisher);
    await publisher.publish({
      subject: `${subjectBase}.single`,
      data: { hello: 'world', n: 1 },
    } as never);

    const info = await jsm.streams.info(streamName);
    expect(info.state.messages).toBeGreaterThanOrEqual(1);
    const stored = await jsm.streams.getMessage(streamName, {
      seq: info.state.last_seq,
    });
    expect(new TextDecoder().decode(stored.data as Uint8Array)).toBe(
      JSON.stringify({ hello: 'world', n: 1 }),
    );
  });

  test('publishBatch publishes every event', async () => {
    const publisher = new NatsPublisher(nc);
    await publisher.publishBatch([
      { subject: `${subjectBase}.b1`, data: { n: 1 } },
      { subject: `${subjectBase}.b2`, data: { n: 2 } },
    ] as never[]);
    const info = await jsm.streams.info(streamName);
    expect(info.state.messages).toBeGreaterThanOrEqual(3);
  });

  test('rejects and logs when no stream captures the subject', async () => {
    const publisher = new NatsPublisher(nc);
    await expect(
      publisher.publish({ subject: `w10.nostream.${uniqueId('x')}`, data: {} } as never),
    ).rejects.toThrow();
  });
});

describe('legacy NatsConsumer', () => {
  let nc: NatsConnection;
  let jsm: JetStreamManager;
  const tag = uniqueId('lc');
  const streamName = `W10_LC_${tag.toUpperCase()}`;
  const subjectBase = `w10.lc.${tag}`;
  const createdConsumers: { stream: string; name: string }[] = [];

  beforeAll(async () => {
    nc = await connectTestNats('lc');
    jsm = await nc.jetstreamManager();
    await createTestStream(jsm, streamName, [`${subjectBase}.>`]);
  });

  afterAll(async () => {
    if (nc) {
      const cleanup = await connectTestNats('lc-cleanup');
      const cjsm = await cleanup.jetstreamManager();
      for (const { stream, name } of createdConsumers.splice(0)) {
        await cjsm.consumers.delete(stream, name).catch(() => undefined);
      }
      await deleteStreamQuietly(cjsm, streamName);
      await cleanup.drain();
      await nc.drain().catch(() => undefined);
    }
  });

  test('subscribes, handles successes and naks failures until drained', async () => {
    const consumer = createConsumer(nc);
    const handled: unknown[] = [];
    const consumerName = `w10-lc-${tag}-cons`;
    createdConsumers.push({ stream: streamName, name: consumerName });

    const subscription = consumer.subscribe<{ n: number; failFirst?: boolean }>(
      `${subjectBase}.events`,
      async (data) => {
        handled.push(data);
        if (data.failFirst && handled.length === 2) {
          // first delivery of the poison message fails
          throw new Error('poison');
        }
      },
      { stream: streamName, consumer: consumerName },
    );

    // wait for the durable consumer to exist before publishing
    await waitFor(() => jsm.consumers.info(streamName, consumerName).then(() => true));
    await nc.jetstream().publish(`${subjectBase}.events`, new TextEncoder().encode(JSON.stringify({ n: 1 })));
    await nc.jetstream().publish(`${subjectBase}.events`, new TextEncoder().encode(JSON.stringify({ n: 2, failFirst: true })));

    // two successes: message 1 plus message 2 on its second delivery
    await waitFor(() => handled.length >= 3);
    await sleep(200);
    // end the consume loop cleanly by draining the connection
    await nc.drain();
    await subscription;

    expect(handled.map((m) => (m as { n: number }).n).sort()).toEqual([1, 2, 2]);
  });

  test('ensureConsumer creates then detects existing consumers', async () => {
    const consumer = new NatsConsumer(await connectTestNats('lc2'));
    const consumerName = `w10-lc2-${uniqueId('n')}`;
    createdConsumers.push({ stream: streamName, name: consumerName });

    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    await consumer.ensureConsumer(streamName, consumerName, `${subjectBase}.ensure`);
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).includes(`Consumer ${consumerName} created`)),
    ).toBe(true);

    await consumer.ensureConsumer(streamName, consumerName, `${subjectBase}.ensure`);
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).includes('already exists')),
    ).toBe(true);

    logSpy.mockRestore();
    await (consumer as unknown as { nc: NatsConnection }).nc.drain();
  });

  test('ensureConsumer rethrows non "not found" errors', async () => {
    const consumer = new NatsConsumer(await connectTestNats('lc3'));
    await expect(
      consumer.ensureConsumer('W10_LC_NO_SUCH_STREAM', 'nope-cons', `${subjectBase}.x`),
    ).rejects.toThrow();
    await (consumer as unknown as { nc: NatsConnection }).nc.drain();
  });

  test('subscribe rejects when consumers.get fails', async () => {
    const fakeNc = {
      jetstreamManager: async () => ({
        consumers: {
          info: async () => ({ name: 'exists' }),
        },
      }),
      jetstream: () => ({
        consumers: {
          get: async () => {
            throw new Error('consumer handle exploded');
          },
        },
      }),
    } as unknown as NatsConnection;

    const consumer = new NatsConsumer(fakeNc);
    await expect(
      consumer.subscribe('w10.lc.fake.subject', async () => undefined, {
        stream: 'W10_LC_FAKE',
        consumer: 'fake-cons',
      }),
    ).rejects.toThrow('consumer handle exploded');
  });

  test('maps financial, dlq and ops subjects to their streams', async () => {
    const mappingNc = await connectTestNats('lc-map');
    const mappingJsm = await mappingNc.jetstreamManager();
    // make sure the shared streams this test inspects exist (create-only)
    await ensureSharedStream(mappingJsm, 'AIN_RIDER_FINANCIAL', [
      'ain_rider.payment_processed',
      'ain_rider.wallet_updated',
      'ain_rider.withdrawal_requested',
      'ain_rider.withdrawal_processed',
    ]);
    await ensureSharedStream(mappingJsm, 'AIN_RIDER_OPS', [
      'ain_rider.trip_requested',
      'ain_rider.trip_matched',
      'ain_rider.sos_created',
      'ain_rider.notification_sent',
    ]);
    await ensureSharedStream(mappingJsm, 'AIN_RIDER_DLQ', ['ain_rider.dlq.*']);

    const consumer = createConsumer(mappingNc);
    const cases = [
      {
        subject: 'payment_processed',
        stream: 'AIN_RIDER_FINANCIAL',
        consumerName: 'payment_processed-consumer',
      },
      {
        subject: `ain_rider.dlq.w10map${tag}`,
        stream: 'AIN_RIDER_DLQ',
        consumerName: `ain_rider_dlq_w10map${tag}-consumer`,
      },
      {
        subject: `ain_rider.w10ops${tag}`,
        stream: 'AIN_RIDER_OPS',
        consumerName: `ain_rider_w10ops${tag}-consumer`,
      },
    ];
    for (const c of cases) {
      createdConsumers.push({ stream: c.stream, name: c.consumerName });
    }

    const subscriptions = cases.map((c) =>
      consumer.subscribe(c.subject, async () => undefined),
    );

    // each durable consumer must appear on the mapped stream
    for (const c of cases) {
      await waitFor(() =>
        mappingJsm.consumers.info(c.stream, c.consumerName).then(() => true),
      );
    }

    // draining ends every consume loop, so the subscriptions resolve
    await mappingNc.drain();
    await Promise.all(subscriptions);
  });
});
