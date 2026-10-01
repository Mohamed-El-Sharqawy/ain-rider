import { connect, NatsConnection, ConnectionOptions } from "nats";

// Re-export types for consumers so they don't need direct nats import
export type { NatsConnection, JsMsg } from "nats";

export interface NatsConfig {
  url?: string; // Single URL (backward compatible)
  servers?: string[]; // Multiple URLs for failover (recommended)
  name?: string;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
}

/**
 * Parse NATS cluster URLs from environment.
 * Supports both single URL (NATS_URL) and cluster URLs (NATS_SERVERS).
 *
 * Default cluster: nats://localhost:4222,nats://localhost:4223,nats://localhost:4224
 */
export function getNatsServersFromEnv(): string[] {
  const servers = process.env.NATS_SERVERS;
  if (servers) {
    return servers.split(",").map((s) => s.trim());
  }

  const url = process.env.NATS_URL || "nats://localhost:4222";
  return [url];
}

export async function createNatsConnection(
  config: NatsConfig = {},
): Promise<NatsConnection> {
  // Determine servers: prefer explicit servers array, then url, then env
  let servers: string[];
  if (config.servers && config.servers.length > 0) {
    servers = config.servers;
  } else if (config.url) {
    servers = [config.url];
  } else {
    servers = getNatsServersFromEnv();
  }

  const options: ConnectionOptions = {
    servers, // NATS client will auto-failover across servers
    name: config.name || "ain-rider-service",
    maxReconnectAttempts: config.maxReconnectAttempts || -1, // infinite
    reconnectTimeWait: config.reconnectTimeWait || 2000, // 2 seconds
    ignoreClusterUpdates: false, // Allow server to update cluster membership
  };

  try {
    const nc = await connect(options);
    console.log(
      `[NATS] Connected to ${nc.getServer()} (cluster: ${servers.join(", ")})`,
    );

    // Handle connection events
    // v8 ignore next 12 -- the status iterator only yields on real socket
    // drops (server restarts, network flaps); it is a logging-only side
    // loop and cannot be triggered against the shared dev cluster.
    /* v8 ignore next 12 */
    (async () => {
      for await (const status of nc.status()) {
        console.log(
          `[NATS] Status: ${status.type}:`,
          typeof status.data === "object"
            ? JSON.stringify(status.data)
            : status.data,
        );
      }
    })().catch((err) => {
      console.error("[NATS] Status error:", err);
    });

    return nc;
  } catch (error) {
    console.error("[NATS] Connection failed to all servers:", servers, error);
    throw error;
  }
}
