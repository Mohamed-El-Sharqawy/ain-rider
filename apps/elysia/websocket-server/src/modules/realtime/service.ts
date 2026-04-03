import { ConnectionStore } from '../../shared/connections';
import { wsConnectionsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';
import {
  initNatsConsumers,
  stopNatsConsumers,
  addDriverWatcher,
  removeDriverWatcher,
} from './consumers';

export abstract class RealtimeService {
  /**
   * Initialize NATS subscriptions using JetStreamConsumer
   */
  static async initNatsSubscriptions(): Promise<void> {
    await initNatsConsumers();
  }

  /**
   * Stop all NATS consumers gracefully
   */
  static async stopNatsSubscriptions(): Promise<void> {
    await stopNatsConsumers();
  }

  /**
   * Add a watcher for a driver's location updates
   */
  static addDriverWatcher(driverId: string, watcherKey: string): void {
    addDriverWatcher(driverId, watcherKey);
  }

  /**
   * Remove a watcher for a driver's location updates
   */
  static removeDriverWatcher(driverId: string, watcherKey: string): void {
    removeDriverWatcher(driverId, watcherKey);
  }

  static handleSubscribe(key: string, ws: unknown): void {
    log('info', 'Subscription attempt', { key });
    ConnectionStore.set(key, ws as Parameters<typeof ConnectionStore.set>[1]);
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client subscribed', { key, total: ConnectionStore.size() });
  }

  static handleUnsubscribe(key: string): void {
    ConnectionStore.delete(key);

    // Remove from any driver watchers
    removeDriverWatcher(key.split(':')[1] || '', key);

    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client unsubscribed', { key, total: ConnectionStore.size() });
  }

  static handleDisconnect(ws: unknown): void {
    ConnectionStore.deleteByWs(ws as Parameters<typeof ConnectionStore.deleteByWs>[0]);
    wsConnectionsTotal.set(ConnectionStore.size());
  }
}
