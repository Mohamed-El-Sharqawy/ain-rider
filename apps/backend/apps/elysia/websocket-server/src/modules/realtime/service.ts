import { ConnectionStore } from '../../shared/connections';
import { wsConnectionsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';
import { redisCluster } from '../../shared/redis';
import {
  initNatsConsumers,
  stopNatsConsumers,
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

  static async handleSubscribe(key: string, ws: any): Promise<void> {
    log('info', 'Subscription attempt', { key });
    ConnectionStore.set(key, ws as Parameters<typeof ConnectionStore.set>[1]);
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client subscribed', { key, total: ConnectionStore.size() });

    // State sync: If it's a driver subscription, check for pending assignments
    const [type, id] = key.split(':');
    if (type === 'driver' && id) {
      try {
        const pending = await redisCluster.get(`driver:assignment:pending:${id}`);
        if (pending) {
          log('info', 'Pushing pending assignment to reconnected driver', { driverId: id });
          const data = JSON.parse(pending);
          ws.send(JSON.stringify({ type: 'trip_assigned', data }));
        }
      } catch (e) {
        log('error', 'Failed to check pending assignment', { driverId: id, error: String(e) });
      }
    }
  }

  static handleUnsubscribe(key: string, ws: unknown): void {
    ConnectionStore.removeFromKey(key, ws as Parameters<typeof ConnectionStore.removeFromKey>[1]);
    wsConnectionsTotal.set(ConnectionStore.size());
    log('info', 'Client unsubscribed', { key, total: ConnectionStore.size() });
  }

  static handleDisconnect(ws: unknown): void {
    ConnectionStore.deleteByWs(ws as Parameters<typeof ConnectionStore.deleteByWs>[0]);
    wsConnectionsTotal.set(ConnectionStore.size());
  }
}
