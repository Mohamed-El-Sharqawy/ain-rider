import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import type { NatsPublisher } from '@ain-rider/nats-client';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

let _publisher: NatsPublisher | null = null;

export async function initNats(): Promise<void> {
  const nc = await createNatsConnection({ url: NATS_URL, name: 'location-service' });
  _publisher = createPublisher(nc);
}

export function getPublisher(): NatsPublisher {
  if (!_publisher) throw new Error('NATS publisher not initialized');
  return _publisher;
}
