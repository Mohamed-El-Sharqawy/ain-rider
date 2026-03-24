import { createNatsConnection, createConsumer } from '@ain-rider/nats-client';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { LocationUpdate } from '@ain-rider/shared-types';
import { ConnectionStore } from '../../shared/connections';
import { natsEventsTotal, wsConnectionsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

// Driver watchers: driverId -> Set of WebSocket keys watching this driver
const driverWatchers = new Map<string, Set<string>>();

export abstract class RealtimeService {
  static async initNatsSubscriptions(): Promise<void> {
    const nc = await createNatsConnection({ url: NATS_URL, name: 'websocket-server' });
    const consumer = createConsumer(nc);

    console.log('[NATS] websocket-server connected to JetStream');

    await consumer.subscribe<LocationUpdate>(
      NATS_SUBJECTS.LOCATION_UPDATE,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.LOCATION_UPDATE });
        
        // Send to driver's own connection
        const sent = ConnectionStore.send(`driver:${data.driverId}`, {
          type: 'location_update',
          data,
        });
        
        // If driver not connected, send to riders watching this driver
        if (!sent) {
          ConnectionStore.send(`trip:${data.driverId}:rider`, {
            type: 'driver_location_update',
            data,
          });
        }
        
        // Send to all watchers of this driver
        const watchers = driverWatchers.get(data.driverId);
        if (watchers) {
          for (const watcherKey of watchers) {
            ConnectionStore.send(watcherKey, {
              type: 'driver_location_update',
              data,
            });
          }
        }
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-location' }
    );

    await consumer.subscribe<{ tripId: string; driverId: string; estimatedArrival: number }>(
      NATS_SUBJECTS.TRIP_MATCHED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_MATCHED });
        ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_matched', data });
        ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_assigned', data });
        
        // Add rider as watcher of this driver
        const watchers = driverWatchers.get(data.driverId) ?? new Set();
        watchers.add(`trip:${data.tripId}:rider`);
        driverWatchers.set(data.driverId, watchers);
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-trip-matched' }
    );

    await consumer.subscribe<{ tripId: string; driverId: string }>(
      NATS_SUBJECTS.TRIP_STARTED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_STARTED });
        ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_started', data });
        ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_started', data });
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-trip-started' }
    );

    await consumer.subscribe<{ tripId: string; driverId: string }>(
      NATS_SUBJECTS.TRIP_COMPLETED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_COMPLETED });
        ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_completed', data });
        ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_completed', data });
        
        // Remove rider from driver watchers
        const watchers = driverWatchers.get(data.driverId);
        if (watchers) {
          watchers.delete(`trip:${data.tripId}:rider`);
          if (watchers.size === 0) {
            driverWatchers.delete(data.driverId);
          }
        }
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-trip-completed' }
    );

    await consumer.subscribe<{ userId: string; title: string; body: string }>(
      NATS_SUBJECTS.NOTIFICATION_SENT,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.NOTIFICATION_SENT });
        ConnectionStore.send(`user:${data.userId}`, { type: 'notification', data });
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-notification' }
    );

    await consumer.subscribe<{ sosId: string; userId: string; tripId?: string; location: { lat: number; lng: number } }>(
      NATS_SUBJECTS.SOS_CREATED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.SOS_CREATED });
        // Send SOS alert to all connected admin/support users
        const sent = ConnectionStore.sendToAdmins({ 
          type: 'sos_alert', 
          data: { 
            sosId: data.sosId, 
            userId: data.userId, 
            tripId: data.tripId, 
            location: data.location, 
            status: 'ACTIVE' 
          } 
        });
        log('info', 'SOS alert sent to admins', { sosId: data.sosId, adminsNotified: sent });
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-sos' }
    );

    await consumer.subscribe<{ sosId: string; resolvedBy: string; resolution: string }>(
      NATS_SUBJECTS.SOS_RESOLVED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.SOS_RESOLVED });
        // Notify admins that SOS was resolved
        ConnectionStore.sendToAdmins({ 
          type: 'sos_resolved', 
          data: { 
            sosId: data.sosId, 
            resolvedBy: data.resolvedBy, 
            resolution: data.resolution 
          } 
        });
        log('info', 'SOS resolved notification sent', { sosId: data.sosId });
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-sos-resolved' }
    );

    await consumer.subscribe<{ paymentId: string; tripId: string; riderId: string; driverId: string; amount: number; status: string }>(
      NATS_SUBJECTS.PAYMENT_PROCESSED,
      async (data) => {
        natsEventsTotal.inc({ subject: NATS_SUBJECTS.PAYMENT_PROCESSED });
        // Notify rider
        ConnectionStore.send(`trip:${data.tripId}:rider`, { 
          type: 'payment_processed', 
          data: { paymentId: data.paymentId, amount: data.amount, status: data.status } 
        });
        // Notify driver
        ConnectionStore.send(`driver:${data.driverId}`, { 
          type: 'payment_processed', 
          data: { paymentId: data.paymentId, amount: data.amount, status: data.status } 
        });
      },
      { stream: 'AIN_RIDER', consumer: 'websocket-server-payment' }
    );

    log('info', 'JetStream subscriptions initialized');
    wsConnectionsTotal.set(ConnectionStore.size());
  }

  /**
   * Add a watcher for a driver's location updates
   */
  static addDriverWatcher(driverId: string, watcherKey: string): void {
    const watchers = driverWatchers.get(driverId) ?? new Set();
    watchers.add(watcherKey);
    driverWatchers.set(driverId, watchers);
    log('info', 'Driver watcher added', { driverId, watcherKey, totalWatchers: watchers.size });
  }

  /**
   * Remove a watcher for a driver's location updates
   */
  static removeDriverWatcher(driverId: string, watcherKey: string): void {
    const watchers = driverWatchers.get(driverId);
    if (watchers) {
      watchers.delete(watcherKey);
      if (watchers.size === 0) {
        driverWatchers.delete(driverId);
      }
      log('info', 'Driver watcher removed', { driverId, watcherKey });
    }
  }

  static handleSubscribe(key: string, ws: unknown): void {
    ConnectionStore.set(key, ws as Parameters<typeof ConnectionStore.set>[1]);
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client subscribed', { key, total: ConnectionStore.size() });
  }

  static handleUnsubscribe(key: string): void {
    ConnectionStore.delete(key);
    
    // Remove from any driver watchers
    for (const [driverId, watchers] of driverWatchers.entries()) {
      if (watchers.has(key)) {
        watchers.delete(key);
        if (watchers.size === 0) {
          driverWatchers.delete(driverId);
        }
      }
    }
    
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client unsubscribed', { key, total: ConnectionStore.size() });
  }

  static handleDisconnect(ws: unknown): void {
    ConnectionStore.deleteByWs(ws as Parameters<typeof ConnectionStore.deleteByWs>[0]);
    wsConnectionsTotal.set(ConnectionStore.size());
  }
}
