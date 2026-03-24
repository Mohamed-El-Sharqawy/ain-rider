import type { ServerWebSocket } from 'bun';

export type WsData = { id: string };

const store = new Map<string, ServerWebSocket<WsData>>();

export abstract class ConnectionStore {
  static set(key: string, ws: ServerWebSocket<WsData>): void {
    store.set(key, ws);
  }

  static get(key: string): ServerWebSocket<WsData> | undefined {
    return store.get(key);
  }

  static delete(key: string): void {
    store.delete(key);
  }

  static deleteByWs(ws: ServerWebSocket<WsData>): void {
    for (const [key, conn] of store.entries()) {
      if (conn === ws) {
        store.delete(key);
      }
    }
  }

  static send(key: string, payload: unknown): boolean {
    const ws = store.get(key);
    if (ws) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  static size(): number {
    return store.size;
  }
}
