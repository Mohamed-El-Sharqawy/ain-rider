import { createNatsConnection, createConsumer } from '@ain-rider/nats-client';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { LocationUpdate } from '@ain-rider/shared-types';
import { ConnectionStore } from '../../shared/connections';
import { natsEventsTotal, wsConnectionsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

export abstract class RealtimeService {
  static async initNatsSubscriptions(): Promise<void> {
    const nc = await createNatsConnection({ url: NATS_URL, name: 'websocket-server' });
    const consumer = createConsumer(nc);

    await consumer.subscribe<LocationUpdate>(
      NATS_SUBJECTS.LOCATION_UPDATE,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.LOCATION_UPDATE });
        const sent = ConnectionStore.send(`driver:${data.driverId}`, {
          type: 'location_update',
          data,
        });
        if (!sent) {
          ConnectionStore.send(`trip:${data.driverId}:rider`, {
            type: 'driver_location_update',
            data,
          });
        }
      }
    );

    await consumer.subscribe<{ tripId: string; driverId: string; estimatedArrival: number }>(
      NATS_SUBJECTS.TRIP_MATCHED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_MATCHED });
        ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_matched', data });
        ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_assigned', data });
      }
    );

    await consumer.subscribe<{ tripId: string; driverId: string }>(
      NATS_SUBJECTS.TRIP_STARTED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_STARTED });
        ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_started', data });
        ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_started', data });
      }
    );

    await consumer.subscribe<{ tripId: string; driverId: string }>(
      NATS_SUBJECTS.TRIP_COMPLETED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_COMPLETED });
        ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_completed', data });
        ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_completed', data });
      }
    );

    await consumer.subscribe<{ userId: string; title: string; body: string }>(
      NATS_SUBJECTS.NOTIFICATION_SENT,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.NOTIFICATION_SENT });
        ConnectionStore.send(`user:${data.userId}`, { type: 'notification', data });
      }
    );

    await consumer.subscribe<{ userId: string; tripId?: string }>(
      NATS_SUBJECTS.SOS_CREATED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.SOS_CREATED });
        ConnectionStore.send(`support:all`, { type: 'sos_alert', data });
      }
    );

    log('info', 'NATS subscriptions initialized');
    wsConnectionsTotal.set(ConnectionStore.size());
  }

  static handleSubscribe(key: string, ws: unknown): void {
    ConnectionStore.set(key, ws as Parameters<typeof ConnectionStore.set>[1]);
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client subscribed', { key, total: ConnectionStore.size() });
  }

  static handleUnsubscribe(key: string): void {
    ConnectionStore.delete(key);
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client unsubscribed', { key, total: ConnectionStore.size() });
  }

  static handleDisconnect(ws: unknown): void {
    ConnectionStore.deleteByWs(ws as Parameters<typeof ConnectionStore.deleteByWs>[0]);
    wsConnectionsTotal.set(ConnectionStore.size());
  }
}
