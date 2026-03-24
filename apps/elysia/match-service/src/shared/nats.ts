import { 
  createNatsConnection, 
  JetStreamPublisher, 
  IdempotencyService,
  generateTraceId,
} from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import { createClient } from 'redis';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let _nc: NatsConnection | null = null;
let _publisher: JetStreamPublisher | null = null;
let _idempotency: IdempotencyService | null = null;

export async function initNats(): Promise<void> {
  _nc = await createNatsConnection({ url: NATS_URL, name: 'match-service' });
  _publisher = new JetStreamPublisher(_nc, 'match-service');
  
  // Initialize idempotency service
  const redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();
  _idempotency = new IdempotencyService(redisClient);
  
  console.log('[NATS] match-service connected to JetStream');
}

export function getPublisher(): JetStreamPublisher {
  if (!_publisher) throw new Error('NATS publisher not initialized');
  return _publisher;
}

export function getIdempotency(): IdempotencyService {
  if (!_idempotency) throw new Error('Idempotency service not initialized');
  return _idempotency;
}

export function getConnection(): NatsConnection {
  if (!_nc) throw new Error('NATS connection not initialized');
  return _nc;
}

export function generateTrace(): string {
  return generateTraceId();
}
