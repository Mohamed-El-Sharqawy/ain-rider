/**
 * NATS test connection: wraps @ain-rider/nats-client against the docker
 * NATS cluster, with fast failures instead of the production infinite
 * reconnect loop.
 */

import {
  createNatsConnection,
  NatsConnection,
} from '@ain-rider/nats-client';
import { loadTestEnv } from './env';

export async function createTestNatsConnection(name = 'test'): Promise<NatsConnection> {
  const env = loadTestEnv();
  return createNatsConnection({
    servers: env.natsServers,
    name: `test-${name}`,
    maxReconnectAttempts: 5,
    reconnectTimeWait: 500,
  });
}
