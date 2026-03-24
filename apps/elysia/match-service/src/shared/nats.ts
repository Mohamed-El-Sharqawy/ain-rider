import { createNatsConnection, createPublisher, createConsumer } from '@ain-rider/nats-client';
import type { NatsPublisher, NatsConsumer } from '@ain-rider/nats-client';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

let _publisher: NatsPublisher | null = null;
let _consumer: NatsConsumer | null = null;

export async function initNats(): Promise<void> {
  const nc = await createNatsConnection({ url: NATS_URL, name: 'match-service' });
  _publisher = createPublisher(nc);
  _consumer = createConsumer(nc);
}

export function getPublisher(): NatsPublisher {
  if (!_publisher) throw new Error('NATS publisher not initialized');
  return _publisher;
}

export function getConsumer(): NatsConsumer {
  if (!_consumer) throw new Error('NATS consumer not initialized');
  return _consumer;
}
