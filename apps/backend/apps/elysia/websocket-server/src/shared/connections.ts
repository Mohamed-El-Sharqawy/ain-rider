import type { ServerWebSocket } from 'bun';
import { redisCluster } from './redis';

export type WsData = { id: string };

const PUBSUB_CHANNEL = 'ws-server:broadcast';

const store = new Map<string, Set<ServerWebSocket<WsData>>>();
const adminKeys = new Set<string>();
const allConnections = new Set<ServerWebSocket<WsData>>();

let subscriber: typeof redisCluster | null = null;

async function ensureSubscriber() {
  if (subscriber) return;
  const { createRedisCluster } = await import('@ain-rider/redis-client');
  subscriber = createRedisCluster({
    nodes: (process.env.REDIS_NODES || 'localhost:6379').split(','),
    keyPrefix: 'ws-server:sub:',
  });
  await (subscriber as any).subscribe(PUBSUB_CHANNEL);
  (subscriber as any).on('message', (_channel: string, message: string) => {
    try {
      const { targetKey, payload } = JSON.parse(message);
      const encodedPayload = JSON.stringify(payload);
      if (targetKey) {
        const sockets = store.get(targetKey);
        if (sockets) {
          for (const ws of sockets) {
            ws.send(encodedPayload);
          }
        }
      } else {
        for (const ws of allConnections) {
          ws.send(encodedPayload);
        }
      }
    } catch { }
  });
}

export abstract class ConnectionStore {
  static async init() {
    await ensureSubscriber();
  }

  static addConnection(ws: ServerWebSocket<WsData>): void {
    allConnections.add(ws);
  }

  static set(key: string, ws: ServerWebSocket<WsData>): void {
    let sockets = store.get(key);
    if (!sockets) {
      sockets = new Set();
      store.set(key, sockets);
    }
    sockets.add(ws);
    allConnections.add(ws);
  }

  static get(key: string): Set<ServerWebSocket<WsData>> | undefined {
    return store.get(key);
  }

  static delete(key: string): void {
    store.delete(key);
    adminKeys.delete(key);
  }

  static removeFromKey(key: string, ws: ServerWebSocket<WsData>): void {
    const sockets = store.get(key);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        store.delete(key);
        adminKeys.delete(key);
      }
    }
  }

  static deleteByWs(ws: ServerWebSocket<WsData>): string[] {
    const removedKeys: string[] = [];
    allConnections.delete(ws);
    for (const [key, sockets] of store.entries()) {
      if (sockets.delete(ws)) {
        if (sockets.size === 0) {
          store.delete(key);
          adminKeys.delete(key);
        }
        removedKeys.push(key);
      }
    }
    return removedKeys;
  }

  static send(key: string, payload: unknown): boolean {
    const sockets = store.get(key);
    if (sockets && sockets.size > 0) {
      const message = JSON.stringify(payload);
      for (const ws of sockets) {
        ws.send(message);
      }
      return true;
    }
    redisCluster.publish(PUBSUB_CHANNEL, JSON.stringify({ targetKey: key, payload })).catch(() => { });
    return false;
  }

  static broadcast(payload: unknown): number {
    let sent = 0;
    const message = JSON.stringify(payload);
    for (const ws of allConnections) {
      ws.send(message);
      sent++;
    }
    redisCluster.publish(PUBSUB_CHANNEL, JSON.stringify({ payload })).catch(() => { });
    return sent;
  }

  static size(): number {
    return allConnections.size;
  }

  static registerAdmin(userId: string, ws: ServerWebSocket<WsData>): void {
    const key = `admin:${userId}`;
    this.set(key, ws);
    adminKeys.add(key);
  }

  static getAdminUsers(): string[] {
    return Array.from(adminKeys);
  }

  static sendToAdmins(payload: unknown): number {
    let sent = 0;
    const message = JSON.stringify(payload);
    for (const key of adminKeys) {
      const sockets = store.get(key);
      if (sockets) {
        for (const ws of sockets) {
          ws.send(message);
          sent++;
        }
      }
    }
    // Note: We don't publish to Redis here because sendToAdmins is usually for local broadcast
    // or the redis message would be broad. Actually, if we want cross-server admin broadcast,
    // we should publish. But for now following existing pattern.
    return sent;
  }
}
