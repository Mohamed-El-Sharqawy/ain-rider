import "./env";
import {
  createNatsConnection,
  type NatsConnection,
} from "@ain-rider/nats-client";
import { getConnection, initNats } from "../../src/shared/nats";

/**
 * Initialize the service's own NATS singleton (nats.ts) exactly once.
 * matchDriver requires the publisher/idempotency singletons to exist.
 */
export async function ensureServiceNats(): Promise<void> {
  try {
    getConnection();
  } catch {
    await initNats();
  }
}

/** Idempotently make sure the JetStream streams used by matching exist. */
export async function ensureStreams(): Promise<void> {
  const nc = await createNatsConnection({ name: "match-service-test-streams" });
  try {
    // Full subject union: parallel suites share one NATS cluster and an
    // uncovered subject never receives a JetStream ack.
    const { provisionSharedStreams } = await import("@ain-rider/test-utils");
    await provisionSharedStreams(nc);
  } finally {
    await nc.close();
  }
}

interface ReceivedEvent {
  subject: string;
  envelope: any;
}

/** Subscribe to subjects on a dedicated connection and collect envelopes. */
export class EventCollector {
  private readonly nc: NatsConnection;
  private readonly received: ReceivedEvent[] = [];

  private constructor(nc: NatsConnection) {
    this.nc = nc;
  }

  static async start(subjects: string[]): Promise<EventCollector> {
    const nc = await createNatsConnection({
      name: "match-service-test-collector",
    });
    const collector = new EventCollector(nc);
    const decoder = new TextDecoder();
    for (const subject of subjects) {
      const sub = nc.subscribe(subject);
      void (async () => {
        for await (const msg of sub) {
          try {
            collector.received.push({
              subject: msg.subject,
              envelope: JSON.parse(decoder.decode(msg.data)),
            });
          } catch {
            // ignore malformed frames
          }
        }
      })();
    }
    return collector;
  }

  /** Resolve with the first envelope for `subject` matching `predicate`. */
  async waitFor(
    subject: string,
    predicate?: (data: any) => boolean,
    timeoutMs = 8000,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.received.find(
        (r) =>
          r.subject === subject && (!predicate || predicate(r.envelope?.data)),
      );
      if (hit) return hit.envelope;
      if (Date.now() > deadline) {
        throw new Error(
          `no ${subject} event within ${timeoutMs}ms (collected ${this.received.length} events)`,
        );
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  /** Reject if any event for `subject` (optionally matching `predicate`) shows up within `ms`. */
  async expectNone(
    subject: string,
    predicate: ((data: any) => boolean) | undefined,
    ms = 1000,
  ): Promise<void> {
    const deadline = Date.now() + ms;
    for (;;) {
      const hit = this.received.find(
        (r) =>
          r.subject === subject && (!predicate || predicate(r.envelope?.data)),
      );
      if (hit) throw new Error(`unexpected ${subject} event received`);
      if (Date.now() > deadline) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  countFor(subject: string, predicate?: (data: any) => boolean): number {
    return this.received.filter(
      (r) =>
        r.subject === subject && (!predicate || predicate(r.envelope?.data)),
    ).length;
  }

  async stop(): Promise<void> {
    await this.nc.drain().catch(() => undefined);
  }
}
