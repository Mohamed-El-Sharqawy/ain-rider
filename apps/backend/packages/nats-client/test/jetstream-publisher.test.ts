import { afterAll, describe, expect, test } from "vitest";
import type { JetStreamPublishOptions, NatsConnection } from "nats";
import {
  JetStreamPublisher,
  createJetStreamPublisher,
} from "../src/jetstream/publisher";
import {
  createTestStream,
  connectTestNats,
  deleteStreamQuietly,
  uniqueId,
} from "./helpers";

describe("JetStreamPublisher", () => {
  let nc: NatsConnection;
  let jsm: Awaited<ReturnType<NatsConnection["jetstreamManager"]>>;
  const streamName = `W10_PUB_${uniqueId("t")}`;
  const subjects = [`w10.pub.${streamName.toLowerCase()}.>`];

  afterAll(async () => {
    if (nc) {
      await nc.drain().catch(() => undefined);
      const cleanup = await connectTestNats("pub-cleanup");
      await deleteStreamQuietly(await cleanup.jetstreamManager(), streamName);
      await cleanup.drain();
    }
  });

  test("publishes an enveloped event with tracing and dedup headers", async () => {
    nc = await connectTestNats("pub");
    jsm = await nc.jetstreamManager();
    await createTestStream(jsm, streamName, subjects);

    const publisher = new JetStreamPublisher(nc, "test-service");
    const traceId = "c".repeat(32);
    const ack = await publisher.publish(
      subjects[0]! + ".created",
      "trip_requested",
      { tripId: "trip-1" },
      {
        eventId: "evt-fixed-1",
        traceId,
        version: 3,
        headers: { "X-Custom": "yes" },
      },
    );

    expect(ack.stream).toBe(streamName);
    expect(ack.duplicate).toBe(false);

    const stored = await jsm.streams.getMessage(streamName, { seq: ack.seq });
    const envelope = JSON.parse(
      new TextDecoder().decode(stored.data as Uint8Array),
    );
    expect(envelope).toMatchObject({
      version: 3,
      eventType: "trip_requested",
      eventId: "evt-fixed-1",
      idempotencyKey: "evt-fixed-1",
      traceId,
      source: "test-service",
      data: { tripId: "trip-1" },
    });
    // headers are visible to consumers even when getMessage omits them
    const headerConsumerName = `w10-pub-hdr-${streamName.toLowerCase()}`;
    await jsm.consumers.add(streamName, {
      durable_name: headerConsumerName,
      filter_subject: subjects[0]!,
      ack_policy: "explicit" as never,
      deliver_policy: "all" as never,
    });
    const consumer = await nc
      .jetstream()
      .consumers.get(streamName, headerConsumerName);
    const iter = await consumer.consume();
    for await (const msg of iter) {
      expect(msg.headers?.get("traceparent")).toMatch(
        new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`),
      );
      expect(msg.headers?.get("Nats-Msg-Id")).toBe("evt-fixed-1");
      expect(msg.headers?.get("Nats-Source")).toBe("test-service");
      expect(msg.headers?.get("Nats-Event-Type")).toBe("trip_requested");
      expect(msg.headers?.get("X-Custom")).toBe("yes");
      msg.ack();
      break;
    }
    await jsm.consumers.delete(streamName, headerConsumerName);
  });

  test("generates ids and defaults the version when no options are given", async () => {
    const publisher = new JetStreamPublisher(nc, "test-service");
    const ack = await publisher.publish(
      subjects[0]! + ".auto",
      "user_created",
      { userId: "u-1" },
    );
    const stored = await jsm.streams.getMessage(streamName, { seq: ack.seq });
    const envelope = JSON.parse(
      new TextDecoder().decode(stored.data as Uint8Array),
    );
    expect(envelope.version).toBe(1);
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(envelope.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  test("defaults the service name from SERVICE_NAME or unknown-service", async () => {
    const saved = process.env.SERVICE_NAME;
    try {
      delete process.env.SERVICE_NAME;
      const fallback = new JetStreamPublisher(nc);
      const ack = await fallback.publish(
        subjects[0]! + ".svc",
        "user_created",
        {},
      );
      const stored = await jsm.streams.getMessage(streamName, { seq: ack.seq });
      const envelope = JSON.parse(
        new TextDecoder().decode(stored.data as Uint8Array),
      );
      expect(envelope.source).toBe("unknown-service");

      process.env.SERVICE_NAME = "env-service";
      const fromEnv = new JetStreamPublisher(nc);
      const ack2 = await fromEnv.publish(
        subjects[0]! + ".svc2",
        "user_created",
        {},
      );
      const stored2 = await jsm.streams.getMessage(streamName, {
        seq: ack2.seq,
      });
      const envelope2 = JSON.parse(
        new TextDecoder().decode(stored2.data as Uint8Array),
      );
      expect(envelope2.source).toBe("env-service");
    } finally {
      if (saved === undefined) {
        delete process.env.SERVICE_NAME;
      } else {
        process.env.SERVICE_NAME = saved;
      }
    }
  });

  test("publishBatch shares one trace id across all events", async () => {
    const publisher = createJetStreamPublisher(nc, "batch-service");
    const acks = await publisher.publishBatch(
      [
        {
          subject: subjects[0]! + ".b1",
          eventType: "user_created",
          data: { n: 1 },
        },
        {
          subject: subjects[0]! + ".b2",
          eventType: "user_created",
          data: { n: 2 },
        },
        {
          subject: subjects[0]! + ".b3",
          eventType: "user_created",
          data: { n: 3 },
        },
      ],
      "d".repeat(32),
    );

    expect(acks).toHaveLength(3);
    const envelopes = [];
    for (const ack of acks) {
      const stored = await jsm.streams.getMessage(streamName, { seq: ack.seq });
      envelopes.push(
        JSON.parse(new TextDecoder().decode(stored.data as Uint8Array)),
      );
    }
    for (const envelope of envelopes) {
      expect(envelope.traceId).toBe("d".repeat(32));
      expect(envelope.source).toBe("batch-service");
    }
    expect(new Set(envelopes.map((e) => e.eventId)).size).toBe(3);
  });

  test("publishBatch generates a shared trace id when none is given", async () => {
    const publisher = new JetStreamPublisher(nc, "batch-service");
    const acks = await publisher.publishBatch([
      {
        subject: subjects[0]! + ".b4",
        eventType: "user_created",
        data: { n: 4 },
      },
      {
        subject: subjects[0]! + ".b5",
        eventType: "user_created",
        data: { n: 5 },
      },
    ]);
    const e1 = JSON.parse(
      new TextDecoder().decode(
        (await jsm.streams.getMessage(streamName, { seq: acks[0]!.seq }))
          .data as Uint8Array,
      ),
    );
    const e2 = JSON.parse(
      new TextDecoder().decode(
        (await jsm.streams.getMessage(streamName, { seq: acks[1]!.seq }))
          .data as Uint8Array,
      ),
    );
    expect(e1.traceId).toBe(e2.traceId);
    expect(e1.eventId).not.toBe(e2.eventId);
  });

  test("rejects when no stream captures the subject", async () => {
    const publisher = new JetStreamPublisher(nc, "test-service");
    await expect(
      publisher.publish(
        `w10.nostream.${uniqueId("x")}.nope`,
        "user_created",
        {},
      ),
    ).rejects.toThrow();
  });

  test("honors NATS_JS_TIMEOUT_MS as the per-publish ack wait", async () => {
    const publishCalls: Array<Partial<JetStreamPublishOptions>> = [];
    const stubJs = {
      publish: async (
        _s: string,
        _d: Uint8Array,
        opts?: Partial<JetStreamPublishOptions>,
      ) => {
        publishCalls.push(opts ?? {});
        return { stream: "x", seq: 1, duplicate: false } as never;
      },
    };
    const stub = {
      jetstream: () =>
        stubJs as unknown as ReturnType<NatsConnection["jetstream"]>,
    } as unknown as NatsConnection;

    const saved = process.env.NATS_JS_TIMEOUT_MS;
    try {
      process.env.NATS_JS_TIMEOUT_MS = "30000";
      const tuned = new JetStreamPublisher(stub, "timeout-service");
      await tuned.publish("ain_rider.tests", "test_event", { ok: true });
      delete process.env.NATS_JS_TIMEOUT_MS;
      const defaulted = new JetStreamPublisher(stub, "timeout-service");
      await defaulted.publish("ain_rider.tests", "test_event", { ok: true });
    } finally {
      if (saved === undefined) delete process.env.NATS_JS_TIMEOUT_MS;
      else process.env.NATS_JS_TIMEOUT_MS = saved;
    }

    expect(publishCalls[0].timeout).toBe(30000);
    expect(publishCalls[1].timeout).toBe(5000);
  });
});
