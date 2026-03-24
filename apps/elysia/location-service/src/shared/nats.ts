import { createNatsConnection, JetStreamPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from '@ain-rider/nats-client';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

let _nc: NatsConnection | null = null;
let _publisher: JetStreamPublisher | null = null;

export async function initNats(): Promise<void> {
  _nc = await createNatsConnection({ url: NATS_URL, name: 'location-service' });
  _publisher = new JetStreamPublisher(_nc);
  console.log('[NATS] location-service connected');
}

export function getPublisher(): JetStreamPublisher {
  if (!_publisher) throw new Error('NATS publisher not initialized');
  return _publisher;
}

export function getConnection(): NatsConnection {
  if (!_nc) throw new Error('NATS connection not initialized');
  return _nc;
}
