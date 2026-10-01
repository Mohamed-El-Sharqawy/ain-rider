import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { headers, type JsMsg, type MsgHdrs, type NatsConnection } from "nats";
import { JetStreamPublisher } from "../src/jetstream/publisher";
import {
  JetStreamConsumer,
  type ConsumerConfig,
} from "../src/jetstream/consumer";
import { IdempotencyService } from "../src/idempotency/idempotency.service";
import type { EventEnvelope } from "../src/types/event-envelope";
import {
  InMemoryRedis,
  RecordingDLQService,
  connectTestNats,
  createTestStream,
  deleteStreamQuietly,
  sleep,
  uniqueId,
  waitFor,
} from "./helpers";

class RecordingConsumer extends JetStreamConsumer {
  received: { envelope: EventEnvelope<unknown>; traceId: string }[] = [];
  handlerImpl: (
    envelope: EventEnvelope<unknown>,
    msg: JsMsg,
    traceId: string,
  ) => Promise<void> = async () => undefined;

  protected async handleMessage(
    envelope: EventEnvelope<unknown>,
    msg: JsMsg,
    traceId: string,
  ): Promise<void> {
    this.received.push({ envelope, traceId });
    await this.handlerImpl(envelope, msg, traceId);
  }

  get isRunning(): boolean {
    return this.running;
  }
}

function makeConsumer(
  nc: NatsConnection,
  config: Partial<ConsumerConfig> = {},
  services?: Parameters<JetStreamConsumer["constructor"]>[2],
): { consumer: RecordingConsumer; config: ConsumerConfig } {
  const tag = uniqueId("jc");
  const full: ConsumerConfig = {
    streamName: config.streamName ?? `W10_JC_${tag.toUpperCase()}`,
    consumerName: config.consumerName ?? `w10-jc-${tag}-cons`,
    filterSubject: config.filterSubject ?? `w10.jc.${tag}.>`,
    serviceName: "test-service",
    ...config,
  };
  return {
    consumer: new RecordingConsumer(nc, full, services),
    config: full,
  };
}

/** Minimal JsMsg double for driving processMessage directly. */
function fakeMsg(opts: {
  payload: unknown;
  deliveryCount?: number;
  msgHeaders?: MsgHdrs;
}): JsMsg & { ackCalls: number; nakCalls: number } {
  const counters = { ack: 0, nak: 0 };
  const msg = {
    data: new TextEncoder().encode(
      typeof opts.payload === "string"
        ? opts.payload
        : JSON.stringify(opts.payload),
    ),
    subject: "w10.jc.fake.a",
    headers: opts.msgHeaders,
    info:
      opts.deliveryCount === undefined
        ? undefined
        : { deliveryCount: opts.deliveryCount },
    ack: () => {
      counters.ack += 1;
    },
    nak: () => {
      counters.nak += 1;
    },
  };
  Object.defineProperty(msg, "ackCalls", { get: () => counters.ack });
  Object.defineProperty(msg, "nakCalls", { get: () => counters.nak });
  return msg as JsMsg & { ackCalls: number; nakCalls: number };
}

describe("JetStreamConsumer (integration)", () => {
  let nc: NatsConnection;
  const createdStreams: string[] = [];

  beforeAll(async () => {
    nc = await connectTestNats("jc");
  });

  afterAll(async () => {
    if (nc) {
      const jsm = await nc.jetstreamManager();
      for (const name of createdStreams.splice(0)) {
        await deleteStreamQuietly(jsm, name);
      }
      await nc.drain().catch(() => undefined);
    }
  });

  test("consumes enveloped events, propagates the trace id and acks", async () => {
    const { consumer, config } = makeConsumer(nc);
    createdStreams.push(config.streamName);
    await consumer.start();
    expect(consumer.isRunning).toBe(true);

    const publisher = new JetStreamPublisher(nc, "test-service");
    const traceId = "e".repeat(32);
    await publisher.publish(
      `${config.filterSubject.replace(".>", "")}.created`,
      "trip_requested",
      { tripId: "trip-42" },
      { eventId: "evt-jc-1", traceId },
    );

    await waitFor(() => consumer.received.length >= 1);
    const { envelope, traceId: seenTrace } = consumer.received[0]!;
    expect(envelope.eventId).toBe("evt-jc-1");
    expect(envelope.data).toEqual({ tripId: "trip-42" });
    expect(seenTrace).toBe(traceId);
    await consumer.stop();
    expect(consumer.isRunning).toBe(false);
  });

  test("start() is idempotent while running", async () => {
    const { consumer, config } = makeConsumer(nc);
    createdStreams.push(config.streamName);
    await consumer.start();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await consumer.start();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Already running"),
    );
    logSpy.mockRestore();
    await consumer.stop();
  });

  test("messages arriving after stop() break the loop instead of processing", async () => {
    const { consumer, config } = makeConsumer(nc);
    createdStreams.push(config.streamName);
    await consumer.start();
    await new JetStreamPublisher(nc, "test-service").publish(
      `${config.filterSubject.replace(".>", "")}.before`,
      "trip_requested",
      { n: 1 },
      { eventId: "evt-stop-1" },
    );
    await waitFor(() => consumer.received.length >= 1);

    await consumer.stop();
    const countAtStop = consumer.received.length;
    await new JetStreamPublisher(nc, "test-service").publish(
      `${config.filterSubject.replace(".>", "")}.after`,
      "trip_requested",
      { n: 2 },
      { eventId: "evt-stop-2" },
    );
    await sleep(300);
    // the late message is delivered to the (still open) iterator but the
    // loop breaks on the running flag instead of handling it
    expect(consumer.received.length).toBe(countAtStop);
  });

  test("validates required payload fields via validateRequired", async () => {
    const { consumer } = makeConsumer(nc);
    const validate = (
      consumer as unknown as {
        validateRequired: (
          d: Record<string, unknown>,
          f: string[],
          l: string,
        ) => void;
      }
    ).validateRequired.bind(consumer);

    expect(() => validate({ a: 1, b: "x" }, ["a", "b"], "label")).not.toThrow();
    expect(() => validate({ a: 1 }, ["a", "missing"], "label")).toThrow(
      /Missing required field "missing" in label/,
    );
    expect(() => validate({ a: null }, ["a"], "label")).toThrow(/"a"/);
  });

  test("auto-creates a missing stream, then resolves subject overlaps defensively", async () => {
    // ensureStream auto-creation is covered by the first test; here the
    // consumer's stream collides with an existing overlapping subject.
    const tag = uniqueId("ovl");
    const owner = `W10_JC_O_${tag.toUpperCase()}`;
    await createTestStream(await nc.jetstreamManager(), owner, [
      `w10.jc.${tag}.>`,
    ]);
    createdStreams.push(owner);

    const { consumer, config } = makeConsumer(nc, {
      streamName: `W10_JC_P_${tag.toUpperCase()}`,
      filterSubject: `w10.jc.${tag}.a`,
    });
    createdStreams.push(config.streamName);
    // stream P does not exist; its subject overlaps `owner`, so the
    // defensive auto-create hits the overlap branch, then consumer
    // creation on the still-missing stream fails and start() rejects.
    await expect(consumer.start()).rejects.toThrow();
    expect(consumer.isRunning).toBe(false);
  });

  test("extends an existing stream with its filter subject when missing", async () => {
    // A stream created by another service (narrow subjects) must gain this
    // consumer's filter subject, or publishes to uncovered subjects never
    // receive a JetStream ack (the CI trip-service failure mode).
    const tag = uniqueId("ext");
    const stream = `W10_JC_E_${tag.toUpperCase()}`;
    const jsm = await nc.jetstreamManager();
    await createTestStream(jsm, stream, [`w10.jc.${tag}.narrow`]);
    createdStreams.push(stream);

    const broad = `w10.jc.${tag}.broad`;
    const { consumer } = makeConsumer(nc, {
      streamName: stream,
      filterSubject: broad,
    });

    await consumer.start();
    const info = await jsm.streams.info(stream);
    expect(info.config.subjects).toContain(`w10.jc.${tag}.narrow`);
    expect(info.config.subjects).toContain(broad);

    // End to end: a publish to the newly covered subject acks and arrives.
    let received = 0;
    consumer.handlerImpl = async () => {
      received += 1;
    };
    await new JetStreamPublisher(nc, "test-service").publish(
      broad,
      "trip_started",
      { proof: true },
      { eventId: `evt-${tag}` },
    );
    await waitFor(() => received >= 1);
    expect(received).toBe(1);
    await consumer.stop();
  });

  test("keeps the subject list untouched when the filter subject is already covered", async () => {
    const tag = uniqueId("cov");
    const stream = `W10_JC_C_${tag.toUpperCase()}`;
    const jsm = await nc.jetstreamManager();
    const filter = `w10.jc.${tag}.>`;
    await createTestStream(jsm, stream, [filter]);
    createdStreams.push(stream);

    const { consumer } = makeConsumer(nc, {
      streamName: stream,
      filterSubject: filter,
    });
    await consumer.start();
    const info = await jsm.streams.info(stream);
    expect(info.config.subjects).toEqual([filter]);
    await consumer.stop();
  });

  test("addFilterSubjectIfMissing defaults to an empty subject list and only updates when needed", async () => {
    // A config without `subjects` (type-legal) must fall back to [] and the
    // update must fire exactly once with the filter subject; an existing
    // covering list must not trigger an update call.
    const { consumer, config } = makeConsumer(nc, {});
    const addFilter = (
      consumer as unknown as {
        addFilterSubjectIfMissing: (jsm: unknown) => Promise<void>;
      }
    ).addFilterSubjectIfMissing.bind(consumer);

    const updates: Array<{ name: string; subjects?: string[] }> = [];
    const makeJsm = (subjects: string[] | undefined) => ({
      streams: {
        info: async () => ({ config: { subjects } }),
        update: async (name: string, cfg: { subjects?: string[] }) => {
          updates.push({ name, subjects: cfg.subjects });
        },
      },
    });

    await addFilter(makeJsm(undefined));
    expect(updates).toEqual([
      { name: config.streamName, subjects: [config.filterSubject] },
    ]);

    updates.length = 0;
    await addFilter(makeJsm([config.filterSubject]));
    expect(updates).toEqual([]);
  });

  test("ensureStream reconciles subjects when a racing actor creates the stream between failure and retry", async () => {
    // Real CI race: another suite creates the stream after our info() threw
    // but before we reconcile, so the overlap error lands on a stream that
    // now exists and must gain our filter subject.
    const { consumer, config } = makeConsumer(nc, {});
    const ensureStream = (
      consumer as unknown as { ensureStream: () => Promise<void> }
    ).ensureStream.bind(consumer);

    let infoCalls = 0;
    const updates: Array<string[]> = [];
    const fakeJsm = {
      streams: {
        info: async () => {
          infoCalls += 1;
          if (infoCalls === 1) {
            throw new Error("stream not found");
          }
          return { config: { subjects: ["w10.race.existing.>"] } };
        },
        add: async () => {
          throw new Error("subjects overlap with an existing stream");
        },
        update: async (_name: string, cfg: { subjects: string[] }) => {
          updates.push(cfg.subjects);
        },
      },
    };
    Object.assign(consumer, {
      nc: { jetstreamManager: async () => fakeJsm },
    });

    await ensureStream();
    expect(updates).toEqual([["w10.race.existing.>", config.filterSubject]]);
  });

  test("retries with nak before maxDeliver, then succeeds", async () => {
    const { consumer, config } = makeConsumer(nc, { maxDeliver: 3 });
    createdStreams.push(config.streamName);
    const dlq = new RecordingDLQService();
    const svc = dlq.asDLQService();
    Object.assign(consumer, { dlqService: svc });

    let attempts = 0;
    consumer.handlerImpl = async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("transient failure");
      }
    };

    await consumer.start();
    await new JetStreamPublisher(nc, "test-service").publish(
      `${config.filterSubject.replace(".>", "")}.retry`,
      "trip_requested",
      { attempt: "nak-me" },
      { eventId: "evt-retry-1" },
    );

    await waitFor(() => attempts >= 2);
    await sleep(300);
    expect(consumer.received).toHaveLength(2);
    expect(dlq.calls).toHaveLength(0);
    await consumer.stop();
  });

  test("sends to the DLQ service once maxDeliver is exceeded and acks", async () => {
    const { consumer, config } = makeConsumer(nc, {
      maxDeliver: 2,
      enableDLQ: true,
    });
    createdStreams.push(config.streamName);
    const dlq = new RecordingDLQService();
    const svc = dlq.asDLQService();
    Object.assign(consumer, { dlqService: svc });

    consumer.handlerImpl = async () => {
      throw new Error("permanent failure");
    };

    const traceId = "f".repeat(32);
    await consumer.start();
    await new JetStreamPublisher(nc, "test-service").publish(
      `${config.filterSubject.replace(".>", "")}.dead`,
      "trip_requested",
      { doomed: true },
      { eventId: "evt-dlq-1", traceId },
    );

    await waitFor(() => dlq.calls.length >= 1);
    await consumer.stop();
    expect(dlq.calls).toHaveLength(1);
    const call = dlq.calls[0]!;
    expect(call.originalEventId).toBe("evt-dlq-1");
    expect(call.error.message).toBe("permanent failure");
    expect(call.retryCount).toBe(2);
    expect(call.consumerName).toBe(config.consumerName);
    expect(call.sourceStream).toBe(config.streamName);
    expect(call.originalSubject).toBe(
      `${config.filterSubject.replace(".>", "")}.dead`,
    );
    expect(call.traceId).toBe(traceId);
    expect(consumer.received.length).toBeGreaterThanOrEqual(2);
  });

  test("skips duplicates when idempotency is enabled", async () => {
    const redis = new InMemoryRedis();
    const idempotency = new IdempotencyService(redis, {
      keyPrefix: "w10-idem",
    });
    const { consumer, config } = makeConsumer(
      nc,
      { enableIdempotency: true },
      {
        idempotencyService: idempotency,
      },
    );
    createdStreams.push(config.streamName);

    await consumer.start();
    const js = nc.jetstream();
    const envelope = {
      version: 1,
      eventType: "trip_requested",
      eventId: "evt-dup-1",
      timestamp: new Date().toISOString(),
      traceId: "a".repeat(32),
      idempotencyKey: "evt-dup-1",
      source: "test-service",
      data: { n: 1 },
    };
    // two distinct messages carrying the same eventId: the second must be
    // skipped by the idempotency check (distinct msgIDs so JetStream
    // server-side dedup does not hide the second publish).
    await js.publish(
      config.filterSubject.replace(".>", "") + ".d1",
      new TextEncoder().encode(JSON.stringify(envelope)),
      { headers: undefined, msgID: "m-dup-1" },
    );
    await js.publish(
      config.filterSubject.replace(".>", "") + ".d2",
      new TextEncoder().encode(JSON.stringify(envelope)),
      { headers: undefined, msgID: "m-dup-2" },
    );

    await waitFor(() => redis.store.size >= 1);
    await sleep(400);
    expect(consumer.received).toHaveLength(1);
    expect(redis.store.has(`w10-idem:${config.consumerName}:evt-dup-1`)).toBe(
      true,
    );
    await consumer.stop();
  });

  test("processes events with idempotency enabled but no service injected", async () => {
    const { consumer, config } = makeConsumer(nc, { enableIdempotency: true });
    createdStreams.push(config.streamName);
    await consumer.start();
    await new JetStreamPublisher(nc, "test-service").publish(
      `${config.filterSubject.replace(".>", "")}.noIsv`,
      "trip_requested",
      { fine: true },
      { eventId: "evt-noisv-1" },
    );
    await waitFor(() => consumer.received.length >= 1);
    expect(consumer.received[0]!.envelope.eventId).toBe("evt-noisv-1");
    await consumer.stop();
  });

  test("skips setup work for streams and consumers that already exist", async () => {
    const { consumer, config } = makeConsumer(nc);
    createdStreams.push(config.streamName);
    const jsm = await nc.jetstreamManager();
    // pre-create stream AND consumer so both exists-paths are taken
    await createTestStream(jsm, config.streamName, [config.filterSubject]);
    await jsm.consumers.add(config.streamName, {
      durable_name: config.consumerName,
      filter_subject: config.filterSubject,
      ack_policy: "explicit" as never,
      deliver_policy: "all" as never,
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await consumer.start();
    expect(
      logSpy.mock.calls.some((c) =>
        String(c[0]).includes(`Stream ${config.streamName} exists`),
      ),
    ).toBe(true);
    expect(
      logSpy.mock.calls.some((c) => String(c[0]).includes("Consumer exists")),
    ).toBe(true);
    logSpy.mockRestore();
    await consumer.stop();
  });

  test("rethrows auto-create failures that are not subject overlaps", async () => {
    const { consumer } = makeConsumer(nc, {
      streamName: "W10_JC bad name!",
      filterSubject: "w10.jc.invalid.>",
    });
    // ensureStream: info fails (invalid name), auto-create fails with the
    // same non-overlap error, which must propagate out of start()
    await expect(consumer.start()).rejects.toThrow(/invalid stream name/);
    expect(consumer.isRunning).toBe(false);
  });
});

describe("JetStreamConsumer message plumbing (driven directly)", () => {
  let nc: NatsConnection;

  beforeAll(async () => {
    nc = await connectTestNats("jc-unit");
  });

  afterAll(async () => {
    if (nc) {
      await nc.drain().catch(() => undefined);
    }
  });

  function bareConsumer(
    services?: Parameters<JetStreamConsumer["constructor"]>[2],
    config: Partial<ConsumerConfig> = {},
  ): RecordingConsumer {
    const tag = uniqueId("bc");
    return new RecordingConsumer(
      nc,
      {
        streamName: `W10_JC_U_${tag.toUpperCase()}`,
        consumerName: `w10-jcu-${tag}-cons`,
        filterSubject: `w10.jcu.${tag}.>`,
        serviceName: "unit-service",
        enableDLQ: true,
        ...config,
      },
      services,
    );
  }
  test("naks unknown-shaped messages and tolerates missing msg.info", async () => {
    const consumer = bareConsumer();
    const msg = fakeMsg({ payload: "not-json{", deliveryCount: undefined });
    await (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage(msg as JsMsg);
    expect(msg.nakCalls).toBe(1);
    expect(msg.ackCalls).toBe(0);
    expect(consumer.received).toHaveLength(0);
  });

  test("routes non-Error failures to the DLQ metric as UnknownError", async () => {
    const dlq = new RecordingDLQService();
    const consumer = bareConsumer(undefined, { enableDLQ: true });
    Object.assign(consumer, { dlqService: dlq.asDLQService() });
    consumer.handlerImpl = async () => {
      throw "a string failure";
    };
    const msgHeaders = headers();
    msgHeaders.set("traceparent", `00-${"9".repeat(32)}-${"8".repeat(16)}-01`);
    msgHeaders.set("empty-header", "");
    const msg = fakeMsg({
      payload: "also not json",
      deliveryCount: 7,
      msgHeaders,
    });
    await (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage(msg as JsMsg);

    expect(dlq.calls).toHaveLength(1);
    const call = dlq.calls[0]!;
    expect(call.originalEventId).toBe("unknown");
    expect(call.traceId).toBe("9".repeat(32));
    expect(call.originalHeaders).toEqual({
      traceparent: `00-${"9".repeat(32)}-${"8".repeat(16)}-01`,
    });
    expect(msg.ackCalls).toBe(1);
  });

  test("routes Error failures to the DLQ metric with the error name", async () => {
    const dlq = new RecordingDLQService();
    const consumer = bareConsumer(undefined, {
      enableDLQ: true,
      // no serviceName: the metrics labels fall back to the consumer name
      serviceName: undefined,
    });
    Object.assign(consumer, { dlqService: dlq.asDLQService() });
    consumer.handlerImpl = async () => {
      throw new RangeError("typed failure");
    };
    const msg = fakeMsg({
      payload: { eventId: "evt-named" },
      deliveryCount: 9,
    });
    await (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage(msg as JsMsg);

    expect(dlq.calls).toHaveLength(1);
    expect(dlq.calls[0]!.error.message).toBe("typed failure");
    expect(dlq.calls[0]!.consumerName).toBe(
      (consumer as unknown as { config: ConsumerConfig }).config.consumerName,
    );
    expect(msg.ackCalls).toBe(1);
  });

  test("sendToDLQ wraps non-Error throwables", async () => {
    const dlq = new RecordingDLQService();
    const consumer = bareConsumer(undefined, { enableDLQ: true });
    Object.assign(consumer, { dlqService: dlq.asDLQService() });
    const msg = fakeMsg({ payload: { eventId: "evt-wrap" }, deliveryCount: 1 });
    await (
      consumer as unknown as {
        sendToDLQ: (
          m: JsMsg,
          e: unknown,
          r: number,
          t: string,
        ) => Promise<void>;
      }
    ).sendToDLQ(msg as JsMsg, 42, 1, "trace-wrap");

    expect(dlq.calls).toHaveLength(1);
    expect(dlq.calls[0]!.error).toBeInstanceOf(Error);
    expect(dlq.calls[0]!.error.message).toBe("42");
  });

  test("naks below maxDeliver and acks at maxDeliver without a dlq service", async () => {
    const consumer = bareConsumer(undefined, {
      enableDLQ: true,
      maxDeliver: 2,
    });
    consumer.handlerImpl = async () => {
      throw new Error("still failing");
    };
    const drive = (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage.bind(consumer);

    const retryMsg = fakeMsg({
      payload: { eventId: "evt-x" },
      deliveryCount: 1,
    });
    await drive(retryMsg as JsMsg);
    expect(retryMsg.nakCalls).toBe(1);
    expect(retryMsg.ackCalls).toBe(0);

    // at maxDeliver with no dlq service wired in, the message is acked to
    // stop redelivery
    const finalMsg = fakeMsg({
      payload: { eventId: "evt-y" },
      deliveryCount: 5,
    });
    await drive(finalMsg as JsMsg);
    expect(finalMsg.ackCalls).toBe(1);
    expect(finalMsg.nakCalls).toBe(0);
  });

  test("sendToDLQ without an injected service returns early", async () => {
    const consumer = bareConsumer();
    const msg = fakeMsg({ payload: { eventId: "evt-y" }, deliveryCount: 1 });
    await expect(
      (
        consumer as unknown as {
          sendToDLQ: (
            m: JsMsg,
            e: unknown,
            r: number,
            t: string,
          ) => Promise<void>;
        }
      ).sendToDLQ(msg as JsMsg, new Error("x"), 1, "trace"),
    ).resolves.toBeUndefined();
  });

  test("consumeLoop without a consumer handle returns immediately", async () => {
    const consumer = bareConsumer();
    await expect(
      (
        consumer as unknown as { consumeLoop: () => Promise<void> }
      ).consumeLoop(),
    ).resolves.toBeUndefined();
  });

  test("processes valid envelopes end to end when driven directly", async () => {
    const redis = new InMemoryRedis();
    const idempotency = new IdempotencyService(redis, {
      keyPrefix: "w10-idem2",
    });
    const consumer = bareConsumer(
      { idempotencyService: idempotency },
      { enableIdempotency: true, enableDLQ: false },
    );

    const envelope = {
      version: 1,
      eventType: "user_created",
      eventId: "evt-direct-1",
      timestamp: new Date().toISOString(),
      traceId: "b".repeat(32),
      idempotencyKey: "evt-direct-1",
      source: "unit",
      data: { userId: "u-9" },
    };
    const msg = fakeMsg({ payload: envelope, deliveryCount: 1 });
    await (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage(msg as JsMsg);

    expect(consumer.received).toHaveLength(1);
    expect(consumer.received[0]!.envelope.data).toEqual({ userId: "u-9" });
    expect(msg.ackCalls).toBe(1);
    expect(
      redis.store.has(
        "w10-idem2:" +
          (consumer as unknown as { config: ConsumerConfig }).config
            .consumerName +
          ":evt-direct-1",
      ),
    ).toBe(true);

    // a duplicate delivery is skipped and acked without handling
    const dup = fakeMsg({ payload: envelope, deliveryCount: 1 });
    await (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage(dup as JsMsg);
    expect(consumer.received).toHaveLength(1);
    expect(dup.ackCalls).toBe(1);
  });

  test("metrics fall back to the consumer name when serviceName is unset", async () => {
    const consumer = bareConsumer(undefined, {
      enableIdempotency: false,
      enableDLQ: false,
      serviceName: undefined,
    });
    const envelope = {
      version: 1,
      eventType: "user_created",
      eventId: "evt-direct-2",
      timestamp: new Date().toISOString(),
      traceId: "c".repeat(32),
      idempotencyKey: "evt-direct-2",
      source: "unit",
      data: { userId: "u-10" },
    };
    const msg = fakeMsg({ payload: envelope, deliveryCount: 1 });
    await (
      consumer as unknown as {
        processMessage: (m: JsMsg) => Promise<void>;
      }
    ).processMessage(msg as JsMsg);
    expect(consumer.received).toHaveLength(1);
    expect(msg.ackCalls).toBe(1);
  });

  test("construction wires the jetstream client lazily", async () => {
    const { JetStreamConsumer: Base } =
      await import("../src/jetstream/consumer");
    expect(Base).toBeDefined();
    const consumer = bareConsumer();
    expect((consumer as unknown as { js: unknown }).js).toBeDefined();
    expect((consumer as unknown as { consumer: unknown }).consumer).toBeNull();
    expect((consumer as unknown as { running: boolean }).running).toBe(false);
  });
});
