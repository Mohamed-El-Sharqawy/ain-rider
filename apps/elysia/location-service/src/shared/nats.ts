/**
 * Location Service NATS Configuration
 *
 * NOTE: This service is a pure JetStream PUBLISHER - it does NOT consume events.
 * It only publishes location_update events after writing to Redis/TimescaleDB.
 * No JetStreamConsumer setup is needed here.
 */

import { createNatsConnection, JetStreamPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from '@ain-rider/nats-client';

const NATS_SERVERS = process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'];
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;

let _nc: NatsConnection | null = null;
let _publisher: JetStreamPublisher | null = null;

export async function initNats(): Promise<void> {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      _nc = await createNatsConnection({ servers: NATS_SERVERS, name: 'location-service' });
      _publisher = new JetStreamPublisher(_nc, 'location-service');
      console.log('[NATS] location-service connected');
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

export function getConnection(): NatsConnection {
  if (!_nc) throw new Error('NATS connection not initialized');
  return _nc;
}
