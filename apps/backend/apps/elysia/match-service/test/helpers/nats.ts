import './env';
import {
  createNatsConnection,
  type NatsConnection,
} from '@ain-rider/nats-client';
import { getConnection, initNats } from '../../src/shared/nats';

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
  const nc = await createNatsConnection({ name: 'match-service-test-streams' });
  try {
    const jsm = await nc.jetstreamManager();
    const wanted: Array<[string, string[]]> = [
      [
        'AIN_RIDER_OPS',
        [
          'ain_rider.trip_requested',
          'ain_rider.trip_assigned',
          'ain_rider.trip_matched',
          'ain_rider.trip_no_match',
        ],
      ],
      ['AIN_RIDER_LOCATION', ['ain_rider.location_update']],
    ];
    for (const [name, subjects] of wanted) {
      try {
        await jsm.streams.info(name);
      } catch {
        try {
          await jsm.streams.add({
            name,
            subjects,
            storage: 1, // file
            num_replicas: 1,
          });
        } catch {
          // subjects overlap with an existing stream that already covers them;
          // publishes work regardless.
        }
      }
    }
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
    const nc = await createNatsConnection({ name: 'match-service-test-collector' });
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
        (r) => r.subject === subject && (!predicate || predicate(r.envelope?.data)),
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
        (r) => r.subject === subject && (!predicate || predicate(r.envelope?.data)),
      );
      if (hit) throw new Error(`unexpected ${subject} event received`);
      if (Date.now() > deadline) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  countFor(subject: string, predicate?: (data: any) => boolean): number {
    return this.received.filter(
      (r) => r.subject === subject && (!predicate || predicate(r.envelope?.data)),
    ).length;
  }

  async stop(): Promise<void> {
    await this.nc.drain().catch(() => undefined);
  }
}
