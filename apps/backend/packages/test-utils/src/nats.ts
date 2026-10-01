/**
 * NATS test connection: wraps @ain-rider/nats-client against the docker
 * NATS cluster, with fast failures instead of the production infinite
 * reconnect loop.
 */

import { createNatsConnection, NatsConnection } from "@ain-rider/nats-client";
import { loadTestEnv } from "./env";

export async function createTestNatsConnection(
  name = "test",
): Promise<NatsConnection> {
  const env = loadTestEnv();
  return createNatsConnection({
    servers: env.natsServers,
    name: `test-${name}`,
    maxReconnectAttempts: 5,
    reconnectTimeWait: 500,
  });
}

/**
 * Subjects every suite publishes or consumes on the shared streams. Suites
 * run in parallel against one cluster; whoever creates a stream first must
 * not strand the others' publishes (an uncovered subject never acks).
 * user and otp subjects are intentionally absent: the AIN_RIDER_AUTH
 * stream owns them, and overlapping subjects make the server reject the
 * whole update.
 */
const OPS_SUBJECTS = [
  "ain_rider.trip_requested",
  "ain_rider.trip_assigned",
  "ain_rider.trip_matched",
  "ain_rider.trip_started",
  "ain_rider.trip_completed",
  "ain_rider.trip_cancelled",
  "ain_rider.trip_rejected",
  "ain_rider.trip_no_match",
  "ain_rider.sos_created",
  "ain_rider.sos_resolved",
];

const LOCATION_SUBJECTS = ["ain_rider.location_update"];

/**
 * Idempotently provision the shared test streams with the full subject
 * union. Extends an existing stream's subject list instead of replacing it.
 */
export async function provisionSharedStreams(
  nc: NatsConnection,
): Promise<void> {
  const jsm = await nc.jetstreamManager();
  const wanted: Array<[string, string[]]> = [
    ["AIN_RIDER_OPS", OPS_SUBJECTS],
    ["AIN_RIDER_LOCATION", LOCATION_SUBJECTS],
  ];
  for (const [name, subjects] of wanted) {
    let exists = true;
    try {
      await jsm.streams.info(name);
    } catch {
      exists = false;
    }
    if (exists) {
      const info = await jsm.streams.info(name);
      const existing = info.config.subjects ?? [];
      const missing = subjects.filter((s) => !existing.includes(s));
      if (missing.length > 0) {
        await jsm.streams.update(name, { subjects: [...existing, ...missing] });
      }
    } else {
      try {
        await jsm.streams.add({
          name,
          subjects,
          storage: "file" as never,
          max_msgs: 100000,
          max_bytes: 100 * 1024 * 1024,
        });
      } catch {
        // Another parallel suite created it first with the same union; done.
      }
    }
  }
}
