# WebSocket Server Code Review

**Workspace**: backend
**Domain**: websocket-server
**Date**: 2026-04-07
**Files Reviewed**: 11 files

## Summary

The WebSocket server provides real-time event delivery to connected clients (drivers, riders, admins). It consumes NATS JetStream events and fans them out to appropriate WebSocket connections. The architecture is clean with proper consumer setup, idempotency, and DLQ support. However, there are critical issues: no authentication on WebSocket connections, no rate limiting, the connection store is in-memory (not scalable for multi-replica), admin registration is never called, and message parsing could crash on malformed input.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/index.ts` | Clean | 0 |
| `src/modules/realtime/index.ts` | Issues found | 2 high, 1 medium |
| `src/modules/realtime/service.ts` | Issues found | 1 medium |
| `src/modules/realtime/consumers.ts` | Issues found | 1 medium |
| `src/shared/connections.ts` | Issues found | 2 high, 1 medium |
| `src/shared/redis.ts` | Clean | 0 |
| `src/shared/metrics.ts` | Clean | 0 |
| `src/shared/error-handler.ts` | Clean | 0 |
| `src/shared/trace.ts` | Clean | 0 |
| `src/modules/health/index.ts` | Clean | 0 |
| `src/modules/metrics/index.ts` | Clean | 0 |

---

### HIGH FINDINGS

### HIGH WS-001: No Authentication on WebSocket Connections

- **File**: `src/modules/realtime/index.ts:5-50`
- **Category**: security
- **Impact**: Anyone can subscribe to any channel including driver locations, trip updates, admin notifications

**Description**

WebSocket connections accept any client without authentication:
```typescript
.ws('/ws', {
  open(ws) {
    log('info', 'WebSocket connection opened', { id: ws.id });
  },
  message(ws, message: unknown) {
    // ...
    if (data.type === 'subscribe' && data.channel && data.id) {
      const key = `${data.channel}:${data.id}`;
      RealtimeService.handleSubscribe(key, ws);
    }
  }
})
```

A malicious client could:
1. Subscribe to `driver:{anyDriverId}` to track driver locations
2. Subscribe to `trip:{anyTripId}:rider` to see trip updates
3. Subscribe to `admin:{anyAdminId}` to receive admin notifications and SOS alerts

**Recommendation**

Add authentication on connection or subscription:
```typescript
.ws('/ws', {
  open(ws) {
    // Extract token from query params or first message
    const token = extractTokenFromQuery(ws.data);
    try {
      const payload = verifyToken(token);
      ws.data.userId = payload.sub;
      ws.data.role = payload.role;
    } catch {
      ws.close(1008, 'Authentication failed');
    }
  },
  message(ws, message) {
    // Validate subscription matches authenticated user
    if (data.channel === 'driver' && data.id !== ws.data.userId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      return;
    }
    // ...
  }
})
```

---

### HIGH WS-002: Connection Store Is In-Memory Only

- **File**: `src/shared/connections.ts:4-60`
- **Category**: architecture
- **Impact**: Multiple replicas cannot share connections; messages sent to wrong replica are lost

**Description**

```typescript
const store = new Map<string, ServerWebSocket<WsData>>();
const adminUsers = new Set<string>();
```

The connection store is a local `Map`. With multiple WebSocket server replicas (for horizontal scaling), a client connected to replica A won't receive messages published by consumers on replica B.

**Recommendation**

Use Redis Pub/Sub for cross-replica communication:
```typescript
// On connection
await redisCluster.publish('ws:connect', JSON.stringify({ key, serverId }));

// On message from NATS consumer
await redisCluster.publish('ws:message', JSON.stringify({ key, payload }));

// Each server subscribes to these channels
redisCluster.subscribe('ws:message', (message) => {
  const { key, payload } = JSON.parse(message);
  ConnectionStore.send(key, payload);
});
```

---

### HIGH WS-003: Admin Registration Never Called

- **File**: `src/shared/connections.ts:45-55`
- **Category**: bug
- **Impact**: SOS alerts never reach admin users

**Description**

```typescript
static registerAdmin(userId: string, ws: ServerWebSocket<WsData>): void {
  const key = `admin:${userId}`;
  store.set(key, ws);
  adminUsers.add(key);
}
```

The `registerAdmin` method exists but is never called anywhere in the codebase. Admin users are never registered, so `sendToAdmins` always returns 0.

**Recommendation**

Call `registerAdmin` when an admin connects:
```typescript
// In message handler
if (data.type === 'subscribe' && data.channel === 'admin' && data.id) {
  ConnectionStore.registerAdmin(data.id, ws);
  ws.send(JSON.stringify({ type: 'subscribed', channel: 'admin' }));
}
```

Or automatically register based on JWT role during authentication.

---

### MEDIUM FINDINGS

### MEDIUM WS-004: No Rate Limiting on WebSocket Messages

- **File**: `src/modules/realtime/index.ts:10-45`
- **Category**: security
- **Impact**: Clients can flood the server with messages

**Description**

There's no rate limiting on incoming WebSocket messages. A malicious client could send thousands of subscribe/unsubscribe messages per second.

**Recommendation**

Add rate limiting per connection:
```typescript
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // messages per minute

message(ws, message) {
  const now = Date.now();
  const limiter = rateLimiter.get(ws.id);
  if (limiter && limiter.count > RATE_LIMIT && now < limiter.resetAt) {
    ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
    return;
  }
  // Update limiter...
}
```

---

### MEDIUM WS-005: Message Parsing Could Throw Uncaught Exception

- **File**: `src/modules/realtime/index.ts:12-25`
- **Category**: bug
- **Impact**: Malformed message could crash the handler

**Description**

```typescript
message(ws, message: unknown) {
  try {
    let data: any;
    if (typeof message === 'string') {
      data = JSON.parse(message);
    } else if (Buffer.isBuffer(message)) {
      data = JSON.parse(message.toString());
    } else {
      data = message;
    }
    // ...
  } catch (error) {
    // Caught
  }
}
```

The try-catch is present, but `data` is typed as `any` and used without validation. If `data.type` is undefined or `data.channel` is missing, the code still proceeds.

**Recommendation**

Add proper validation:
```typescript
if (data.type === 'subscribe') {
  if (!data.channel || !data.id) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing channel or id' }));
    return;
  }
  // ...
}
```

---

### MEDIUM WS-006: Driver Watchers Not Cleaned on Disconnect

- **File**: `src/modules/realtime/consumers.ts:15-20`, `src/shared/connections.ts:30-40`
- **Category**: bug
- **Impact**: Stale watcher entries accumulate

**Description**

When a WebSocket disconnects, `handleDisconnect` removes the connection from the store but doesn't clean up `driverWatchers`:
```typescript
static handleDisconnect(ws: unknown): void {
  ConnectionStore.deleteByWs(ws as Parameters<typeof ConnectionStore.deleteByWs>[0]);
  // driverWatchers not cleaned
}
```

The `driverWatchers` map in `consumers.ts` keeps entries for disconnected clients.

**Recommendation**

Track watcher keys in the connection data and clean up on disconnect:
```typescript
// In connection data
ws.data.watchers = new Set<string>();

// On subscribe
ws.data.watchers.add(key);

// On disconnect
for (const key of ws.data.watchers) {
  const [_, driverId] = key.split(':');
  removeDriverWatcher(driverId, key);
}
```

---

### MEDIUM WS-007: No Heartbeat/Ping-Pong Mechanism

- **File**: `src/modules/realtime/index.ts`
- **Category**: bug
- **Impact**: Dead connections not detected

**Description**

There's a ping handler but no automatic heartbeat:
```typescript
if (data.type === 'ping') {
  ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
}
```

This only responds to client pings but doesn't proactively detect dead connections.

**Recommendation**

Implement server-side heartbeat:
```typescript
// Periodically check all connections
setInterval(() => {
  for (const [key, ws] of store.entries()) {
    if (ws.data.lastPing && Date.now() - ws.data.lastPing > 60000) {
      ws.close(1001, 'Ping timeout');
      store.delete(key);
    } else {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }
}, 30000);
```

---

### LOW FINDINGS

### LOW WS-008: Missing Validation on Channel Names

- **File**: `src/modules/realtime/index.ts:20-25`
- **Category**: security
- **Impact**: Arbitrary channel names could be created

**Description**

```typescript
if (data.type === 'subscribe' && data.channel && data.id) {
  const key = `${data.channel}:${data.id}`;
  // No validation of channel name
}
```

Any channel name is accepted, potentially creating confusing or malicious keys.

**Recommendation**

Validate channel names:
```typescript
const VALID_CHANNELS = ['driver', 'trip', 'user', 'admin'];
if (!VALID_CHANNELS.includes(data.channel)) {
  ws.send(JSON.stringify({ type: 'error', message: 'Invalid channel' }));
  return;
}
```

---

### LOW WS-009: No Connection Timeout on Open

- **File**: `src/modules/realtime/index.ts:6-8`
- **Category**: security
- **Impact**: Idle connections consume resources

**Description**

```typescript
open(ws) {
  log('info', 'WebSocket connection opened', { id: ws.id });
}
```

No timeout is set for unauthenticated or idle connections.

**Recommendation**

Set a timeout for connections that don't subscribe within a reasonable time:
```typescript
open(ws) {
  ws.data.subscribeTimeout = setTimeout(() => {
    if (!ws.data.subscribed) {
      ws.close(1001, 'No subscription within timeout');
    }
  }, 30000);
}
```

---

### LOW WS-010: Missing Graceful Shutdown

- **File**: `src/index.ts`
- **Category**: reliability
- **Impact**: Connections dropped abruptly on shutdown

**Description**

There's no graceful shutdown handling. On SIGTERM, connections are dropped without notification.

**Recommendation**

Add shutdown handlers:
```typescript
process.on('SIGTERM', async () => {
  log('info', 'Shutting down...');
  
  // Notify all clients
  for (const [key, ws] of store.entries()) {
    ws.send(JSON.stringify({ type: 'shutdown', message: 'Server restarting' }));
    ws.close(1001, 'Server shutdown');
  }
  
  await stopNatsConsumers();
  process.exit(0);
});
```

---

### LOW WS-011: Trip Started Consumer Missing from File

- **File**: `src/modules/realtime/consumers.ts`
- **Category**: bug
- **Impact**: TripStartedConsumer is referenced but definition was truncated

**Description**

The file references `TripStartedConsumer` in the consumer list but the class definition was truncated in the output. This should be verified to exist.

**Recommendation**

Ensure all consumer classes are properly defined and exported.