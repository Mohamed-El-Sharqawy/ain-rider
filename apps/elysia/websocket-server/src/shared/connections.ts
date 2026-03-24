import type { ServerWebSocket } from 'bun';

export type WsData = { id: string };

const store = new Map<string, ServerWebSocket<WsData>>();
const adminUsers = new Set<string>(); // Track admin/support user IDs

export abstract class ConnectionStore {
  static set(key: string, ws: ServerWebSocket<WsData>): void {
    store.set(key, ws);
  }

  static get(key: string): ServerWebSocket<WsData> | undefined {
    return store.get(key);
  }

  static delete(key: string): void {
    store.delete(key);
    adminUsers.delete(key); // Remove from admin tracking
  }

  static deleteByWs(ws: ServerWebSocket<WsData>): void {
    for (const [key, conn] of store.entries()) {
      if (conn === ws) {
        store.delete(key);
        adminUsers.delete(key);
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

  // Admin/Support user tracking for SOS alerts
  static registerAdmin(userId: string, ws: ServerWebSocket<WsData>): void {
    const key = `admin:${userId}`;
    store.set(key, ws);
    adminUsers.add(key);
  }

  static getAdminUsers(): string[] {
    return Array.from(adminUsers);
  }

  static sendToAdmins(payload: unknown): number {
    let sent = 0;
    for (const key of adminUsers) {
      if (this.send(key, payload)) {
        sent++;
      }
    }
    return sent;
  }
}
