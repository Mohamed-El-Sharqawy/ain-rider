import { Elysia } from 'elysia';
import { RealtimeService } from './service';
import { wsMessagesTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';
import { ConnectionStore } from '../../shared/connections';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[WebSocket] FATAL: JWT_SECRET environment variable is required. Refusing to start.');
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const SUBSCRIPTION_TIMEOUT_MS = 30_000;

const connectionTimers = new Map<string, {
  heartbeat: ReturnType<typeof setInterval>;
  authTimeout: ReturnType<typeof setTimeout> | null;
  pongTimeout: ReturnType<typeof setTimeout> | null;
}>();

function startHeartbeat(ws: any, wsId: string): void {
  const timers = connectionTimers.get(wsId);
  if (!timers) return;

  timers.heartbeat = setInterval(() => {
    if (ws.readyState !== 1) {
      clearInterval(timers.heartbeat);
      return;
    }

    ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));

    timers.pongTimeout = setTimeout(() => {
      log('warn', 'WebSocket heartbeat timeout — closing connection', { id: wsId });
      ws.close(4003, 'Heartbeat timeout');
    }, HEARTBEAT_TIMEOUT_MS);
  }, HEARTBEAT_INTERVAL_MS);
}

function clearConnectionTimers(wsId: string): void {
  const timers = connectionTimers.get(wsId);
  if (!timers) return;

  clearInterval(timers.heartbeat);
  if (timers.authTimeout) clearTimeout(timers.authTimeout);
  if (timers.pongTimeout) clearTimeout(timers.pongTimeout);
  connectionTimers.delete(wsId);
}

function clearAuthTimeout(wsId: string): void {
  const timers = connectionTimers.get(wsId);
  if (timers && timers.authTimeout) {
    clearTimeout(timers.authTimeout);
    timers.authTimeout = null;
  }
}

async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Use Buffer for reliable base64url decoding in Bun
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      log('warn', 'WebSocket token expired', { 
        sub: payload.sub,
        iat: payload.iat,
        exp: payload.exp, 
        now: Math.floor(Date.now() / 1000) 
      });
      return null;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET!),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], 'base64url');

    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!isValid) {
      log('warn', 'WebSocket signature verification failed');
      return null;
    }

    return payload as JwtPayload;
  } catch (error) {
    log('error', 'WebSocket token verification error', { error: String(error) });
    return null;
  }
}

const VALID_CHANNELS = new Set(['driver', 'trip', 'user', 'admin']);
const messageTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 100;

function checkRateLimit(wsId: string): boolean {
  const now = Date.now();
  const timestamps = messageTimestamps.get(wsId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  messageTimestamps.set(wsId, recent);
  return true;
}

function cleanupRateLimit(wsId: string) {
  messageTimestamps.delete(wsId);
}

function registerUserWs(ws: any, payload: JwtPayload) {
  ws.data.user = payload;
  if (payload.role === 'ADMIN' || payload.role === 'SUPPORT') {
    ConnectionStore.registerAdmin(payload.sub, ws);
  }
}

export const realtime = new Elysia()
  .ws('/ws', {
    async open(ws) {
      const userAgent = ws.data.headers['user-agent'] || 'unknown';
      log('info', 'WebSocket connection opened', { id: ws.id, userAgent });
      ConnectionStore.addConnection(ws as any);

      const timers: any = {
        heartbeat: null,
        authTimeout: null,
        pongTimeout: null,
      };
      connectionTimers.set(ws.id, timers);

      timers.authTimeout = setTimeout(() => {
        const user = (ws.data as any).user;
        if (!user && ws.readyState === 1) {
          log('warn', 'WebSocket closed — no auth within timeout', { id: ws.id });
          ws.close(4004, 'Authentication timeout');
        }
      }, SUBSCRIPTION_TIMEOUT_MS);

      startHeartbeat(ws, ws.id);

      const token = (ws.data as any)?.query?.token || null;

      if (token) {
        const payload = await verifyToken(token);
        if (payload) {
          registerUserWs(ws, payload);
          clearAuthTimeout(ws.id);
          log('info', 'WebSocket authenticated via URL query', { id: ws.id, userId: payload.sub, role: payload.role });
          ws.send(JSON.stringify({ type: 'auth_success', userId: payload.sub, role: payload.role }));
        } else {
          log('warn', 'WebSocket authentication failed - invalid/expired URL token', { id: ws.id });
          ws.send(JSON.stringify({ type: 'auth_error', code: 4001, message: 'Invalid or expired token' }));
          ws.close(4001, 'Authentication failed');
        }
      } else {
        log('info', 'WebSocket awaiting auth message', { id: ws.id });
      }
    },
    async message(ws, message: unknown) {
      try {
        let data: any;
        if (typeof message === 'string') {
          data = JSON.parse(message);
        } else if (Buffer.isBuffer(message)) {
          data = JSON.parse(message.toString());
        } else {
          data = message;
        }

        wsMessagesTotal.inc({ type: data.type, direction: 'inbound' });

        if (data.type === 'pong') {
          const timers = connectionTimers.get(ws.id);
          if (timers?.pongTimeout) {
            clearTimeout(timers.pongTimeout);
            timers.pongTimeout = null;
          }
          return;
        }

        if (data.type === 'auth' && data.token) {
          const payload = await verifyToken(data.token);
          if (payload) {
            registerUserWs(ws, payload);
            clearAuthTimeout(ws.id);
            log('info', 'WebSocket authenticated via message', { id: ws.id, userId: payload.sub, role: payload.role });
            ws.send(JSON.stringify({ type: 'auth_success', userId: payload.sub, role: payload.role }));
          } else {
            log('warn', 'WebSocket auth message failed', { id: ws.id });
            ws.send(JSON.stringify({ type: 'auth_error', code: 4001, message: 'Invalid or expired token' }));
            ws.close(4001, 'Authentication failed');
          }
          return;
        }

        const user = (ws.data as any).user;
        if (!user && data.type !== 'ping') {
          log('warn', 'WebSocket message rejected - not authenticated', { id: ws.id, type: data.type });
          ws.send(JSON.stringify({ type: 'auth_error', code: 4002, message: 'Not authenticated' }));
          return;
        }

        if (!checkRateLimit(ws.id)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
          return;
        }

        if (data.type === 'subscribe' && data.channel && data.id) {
          if (!VALID_CHANNELS.has(data.channel)) {
            ws.send(JSON.stringify({ type: 'error', message: `Invalid channel: ${data.channel}` }));
            return;
          }
          const key = `${data.channel}:${data.id}`;
          await RealtimeService.handleSubscribe(key, ws);
          ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel, id: data.id }));
          wsMessagesTotal.inc({ type: 'subscribed', direction: 'outbound' });
        }

        if (data.type === 'unsubscribe' && data.channel && data.id) {
          const key = `${data.channel}:${data.id}`;
          RealtimeService.handleUnsubscribe(key, ws);
          ws.send(JSON.stringify({ type: 'unsubscribed', channel: data.channel }));
        }

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    },
    close(ws) {
      clearConnectionTimers(ws.id);
      cleanupRateLimit(ws.id);
      RealtimeService.handleDisconnect(ws);
      log('info', 'WebSocket connection closed', { id: ws.id });
    },
  });
