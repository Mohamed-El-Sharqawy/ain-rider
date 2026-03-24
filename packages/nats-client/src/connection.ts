import { connect, NatsConnection, ConnectionOptions } from 'nats';

// Re-export NatsConnection type for consumers
export type { NatsConnection } from 'nats';

export interface NatsConfig {
  url: string;
  name?: string;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
}

export async function createNatsConnection(config: NatsConfig): Promise<NatsConnection> {
  const options: ConnectionOptions = {
    servers: config.url,
    name: config.name || 'ain-rider-service',
    maxReconnectAttempts: config.maxReconnectAttempts || -1, // infinite
    reconnectTimeWait: config.reconnectTimeWait || 2000, // 2 seconds
  };

  try {
    const nc = await connect(options);
    console.log(`[NATS] Connected to ${nc.getServer()}`);

    // Handle connection events
    (async () => {
      for await (const status of nc.status()) {
        console.log(`[NATS] Status: ${status.type}: ${status.data}`);
      }
    })().catch((err) => {
      console.error('[NATS] Status error:', err);
    });

    return nc;
  } catch (error) {
    console.error('[NATS] Connection failed:', error);
    throw error;
  }
}
