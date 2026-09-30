import { 
  createNatsConnection, 
  JetStreamPublisher, 
  IdempotencyService,
  generateTraceId,
} from '@ain-rider/nats-client';
import type { NatsConnection } from '@ain-rider/nats-client';
import { redisCluster } from './redis';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'];
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;

let _nc: NatsConnection | null = null;
let _publisher: JetStreamPublisher | null = null;
let _idempotency: IdempotencyService | null = null;

export async function initNats(): Promise<void> {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      _nc = await createNatsConnection({ servers: NATS_SERVERS, name: 'match-service' });
      _publisher = new JetStreamPublisher(_nc, 'match-service');
      
      // Initialize idempotency service with ioredis cluster client
      _idempotency = new IdempotencyService(redisCluster);
      
      console.log('[NATS] match-service connected to JetStream');
      return;
    } catch (error) {
      retries++;
      console.error(`[NATS] Connection attempt ${retries}/${MAX_RETRIES} failed:`, error);
      
      if (retries >= MAX_RETRIES) {
        throw new Error(`NATS connection failed after ${MAX_RETRIES} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retries));
    }
  }
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
