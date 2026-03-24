# 911 Ain Rider — Backend Architecture Guide

How the backend works, how services communicate, how clients connect, and how Kubernetes handles everything at scale.

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [How a Mobile Request Flows](#2-how-a-mobile-request-flows)
3. [Why Multiple NATS / Redis Instances?](#3-why-multiple-nats--redis-instances)
4. [NATS — The Internal Message Bus](#4-nats--the-internal-message-bus)
5. [Redis — The Shared Fast State](#5-redis--the-shared-fast-state)
6. [Kubernetes — Traffic, Scaling, and Routing](#6-kubernetes--traffic-scaling-and-routing)
7. [What Happens at Scale (Multiple Pod Replicas)](#7-what-happens-at-scale-multiple-pod-replicas)
8. [WebSocket Connections at Scale](#8-websocket-connections-at-scale)
9. [Service Port Map](#9-service-port-map)
10. [Integration Cheatsheet for Frontend / Mobile](#10-integration-cheatsheet-for-frontend--mobile)

---

## 1. Big Picture

```
  Mobile App / Web Dashboard
          │
          │  HTTPS / WSS  (single public domain)
          ▼
  ┌───────────────────┐
  │  Ingress (nginx)  │   ← Kubernetes terminates TLS here
  └────────┬──────────┘
           │  routes by path/host
    ┌──────┴───────┐
    │              │
    ▼              ▼
 API Gateway   WebSocket Server        ← Elysia/Bun (high-throughput)
 :3000          :3001
    │              │
    │ HTTP proxy   │ NATS fanout
    ▼              ▼
 NestJS Services          ← auth-service, trip-service, payment-service, admin-service
 (business logic)
    │
    ▼
 PostgreSQL / TimescaleDB  (via PgBouncer)
 Redis Cluster
 NATS JetStream

 Location Service :3002  ──► NATS ──► WebSocket Server ──► Mobile
 Match Service    :3003  ──► NATS ──► WebSocket Server ──► Mobile
```

The mobile app and web dashboard **never talk to individual backend services directly**. They always go through two entry points:

- **`api.911ainrider.local`** → API Gateway → NestJS services (REST/JSON)
- **`ws.911ainrider.local`** → WebSocket Server (real-time events)

---

## 2. How a Mobile Request Flows

### Example: Rider requests a trip

```
Mobile App
  │
  │  POST /trips  { pickup, dropoff, paymentMethod }
  │  Authorization: Bearer <jwt>
  ▼
Ingress (nginx)
  │  path: /trips → api-gateway
  ▼
API Gateway (Elysia)
  │  1. Rate limit check
  │  2. JWT verify (bearer token)
  │  3. Proxy to trip-service
  ▼
trip-service (NestJS)
  │  1. Validate business rules
  │  2. Write trip to PostgreSQL
  │  3. Publish NATS event: trip.requested
  ▼
NATS JetStream
  │  event: trip.requested { tripId, riderId, pickupLocation }
  ├──► match-service  (finds nearest driver via H3 + Redis)
  │       │  publishes: trip.matched { tripId, driverId }
  │       ▼
  │     NATS
  │       │
  └──────►└──► websocket-server
                  │  sends to rider's WS connection: { type: "trip_matched", data }
                  │  sends to driver's WS connection: { type: "trip_assigned", data }
                  ▼
              Mobile App (real-time update, no polling needed)
```

---

## 3. Why Multiple NATS / Redis Instances?

Each service creates its **own connection** to NATS and Redis. This is not multiple separate servers — it is multiple **clients** connecting to the **same shared server cluster**.

### One NATS cluster, many clients

```
NATS JetStream Cluster (3 nodes for HA)
       ▲     ▲     ▲     ▲     ▲
       │     │     │     │     │
  api-  location  match  trip   websocket
  gateway  svc    svc    svc    server
  (pub)   (pub)  (pub+sub) (sub) (sub)
```

Each service:
- Creates **one TCP connection** to the NATS cluster on startup via `initNats()`
- Keeps that connection alive for the lifetime of the process
- **Publishes** events when something happens (e.g. location updated)
- **Subscribes** to events it cares about (e.g. match-service listens for `trip.requested`)

### Why not one shared connection?

Each service is a **separate process** running in its own container. They cannot share in-memory objects across process boundaries. So each process maintains its own connection. This is normal and expected — the NATS cluster handles thousands of concurrent connections efficiently.

### Why `_publisher = null` and `initNats()`?

```typescript
// location-service/src/shared/nats.ts
let _publisher: NatsPublisher | null = null;

export async function initNats(): Promise<void> {
  const nc = await createNatsConnection({ url: NATS_URL, name: 'location-service' });
  _publisher = createPublisher(nc);
}
```

NATS connections are **async** — you can't open a TCP connection synchronously. So:

1. `initNats()` is called once at process startup in `src/index.ts`
2. It awaits the connection, then stores the publisher in a module-level singleton
3. All subsequent calls to `getPublisher()` reuse the same connection — no reconnect overhead per request
4. If NATS is down at startup, the process exits (intentional — Kubernetes restarts it)

---

## 4. NATS — The Internal Message Bus

NATS JetStream is how backend services **talk to each other asynchronously**. No service calls another service's HTTP endpoint for real-time events — they publish to a subject and any interested subscriber receives it.

### Subject naming (from `shared-types/events.types.ts`)

| Subject | Published by | Consumed by |
|---|---|---|
| `location.update` | location-service | websocket-server |
| `trip.requested` | trip-service | match-service |
| `trip.matched` | match-service | websocket-server, trip-service |
| `trip.started` | trip-service | websocket-server |
| `trip.completed` | trip-service | websocket-server, payment-service |
| `notification.sent` | notification-service | websocket-server |
| `sos.created` | trip-service | websocket-server |

### Why async / NATS instead of direct HTTP calls?

| Direct HTTP call | NATS event |
|---|---|
| If `match-service` is down, `trip-service` request fails | Trip is still created; match-service processes the event when it recovers |
| `trip-service` waits for match result before responding | `trip-service` responds immediately; rider gets update via WebSocket |
| Tight coupling between services | Services are independent; you can add a new subscriber without touching the publisher |
| Hard to fan out to multiple consumers | NATS delivers to all subscribers automatically |

### JetStream vs Core NATS

The project uses **JetStream** (persistent messaging). Events are written to disk on the NATS cluster. If a consumer (e.g. match-service) is temporarily down, it will receive all missed events when it reconnects — **no events are lost**.

---

## 5. Redis — The Shared Fast State

Redis Cluster stores **ephemeral, high-read-frequency state** that needs to be shared across all replicas of a service:

| Key pattern | Stored by | Read by | TTL |
|---|---|---|---|
| `location:driver:location:{driverId}` | location-service | match-service, location-service | 5 min |
| `match:h3:cell:{h3Index}` | match-service | match-service | 5 min |
| `match:driver:available:{driverId}` | match-service | match-service | 5 min |
| `api-gateway:{userId}:ratelimit` | api-gateway | api-gateway | 1 min |

### Why Redis Cluster (not standalone Redis)?

The project runs on-premise in Kubernetes. Redis Cluster:
- **Shards data** across 3+ nodes — more memory capacity
- **Continues serving** if one node fails (automatic failover)
- **No single point of failure** — critical for production

Each service creates its own `ioredis.Cluster` client. The `ioredis` library handles:
- Discovering all cluster nodes automatically
- Routing keys to the correct shard
- Retrying failed commands on another node

### `keyPrefix` — why each service has its own prefix

```typescript
// api-gateway/src/shared/redis.ts
export const redisClient = createRedisCluster({
  nodes: REDIS_NODES,
  keyPrefix: 'api-gateway:',  // ← all keys become "api-gateway:..."
});

// location-service/src/shared/redis.ts
export const redisClient = createRedisCluster({
  nodes: REDIS_NODES,
  keyPrefix: 'location:',     // ← all keys become "location:..."
});
```

All services share the **same Redis cluster**. Prefixes prevent key collisions — `api-gateway:user:123` and `location:user:123` are different keys even though both use the string `user:123`.

---

## 6. Kubernetes — Traffic, Scaling, and Routing

### How the frontend hits a single endpoint

```
Internet
   │
   │  https://api.911ainrider.com/trips
   ▼
LoadBalancer Service (one external IP, assigned by your on-prem LB / MetalLB)
   │
   ▼
Ingress Controller (nginx)
   │  rules:
   │  api.911ainrider.com/auth/*    → api-gateway Service
   │  api.911ainrider.com/trips/*   → api-gateway Service
   │  ws.911ainrider.com/ws         → websocket-server Service
   ▼
Kubernetes Service (ClusterIP)
   │  kube-proxy load-balances across all healthy pods
   ├── api-gateway Pod 1
   ├── api-gateway Pod 2
   └── api-gateway Pod 3
```

The **frontend only ever knows one URL**. Kubernetes routes each request to a healthy pod. If a pod crashes, Kubernetes removes it from the pool within seconds and the next request goes to a healthy pod.

### Ingress rules (simplified)

```yaml
# kubernetes/ingress.yaml
rules:
  - host: api.911ainrider.com
    http:
      paths:
        - path: /
          backend:
            service:
              name: api-gateway
              port: 3000

  - host: ws.911ainrider.com
    http:
      paths:
        - path: /ws
          backend:
            service:
              name: websocket-server
              port: 3001
```

### How services find each other internally

Inside the cluster, services use **Kubernetes DNS**:

```
http://auth-service:4000     → resolves to auth-service ClusterIP
http://trip-service:4001     → resolves to trip-service ClusterIP
nats://nats:4222             → resolves to NATS headless service
redis-cluster:6379           → resolves to Redis cluster nodes
```

These are set as environment variables in each pod's deployment manifest — no hardcoded IPs anywhere.

---

## 7. What Happens at Scale (Multiple Pod Replicas)

This is the key question: **if 3 pods of location-service are running, and driver A sends a location update, which pod handles it? And does it matter?**

### Answer: It does not matter — Redis and NATS make state shared

```
Driver A's phone
  │  POST /location/update
  ▼
Ingress → Kubernetes Service (picks any healthy pod)
  │
  ├── location-service Pod 1  ← might handle this request
  ├── location-service Pod 2
  └── location-service Pod 3

Each pod does the SAME thing:
  1. Compute H3 index
  2. Write to Redis Cluster  ← shared by ALL pods
  3. Write to TimescaleDB    ← shared by ALL pods
  4. Publish to NATS         ← received by ALL interested subscribers
```

Because state lives in Redis and PostgreSQL (not in pod memory), **any pod can handle any request** and produce the correct result. This is called **stateless service design**.

### The one exception: WebSocket connections

WebSocket connections **are stateful** — a connection is pinned to one pod. This is why `websocket-server` uses Redis as the connection store concept and NATS for fanout:

```
Rider's phone  ──WS──►  websocket-server Pod 2  (connection pinned here)

Driver location update
  → location-service (any pod)
  → publishes NATS: location.update
  → ALL websocket-server pods receive the NATS event
  → Pod 2 checks: does it have a connection for "trip:123:rider"?
  → Yes → sends update to rider's phone ✓
  → Pods 1 and 3 also check → No connection → do nothing ✓
```

NATS fanout means the right pod always delivers the message.

---

## 8. WebSocket Connections at Scale

### How the mobile app connects

```typescript
// Mobile app (React Native / Flutter)
const ws = new WebSocket('wss://ws.911ainrider.com/ws');

ws.onopen = () => {
  // Subscribe to your own channels after connecting
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'trip',      // channel name
    id: '123:rider',      // your identifier
  }));
  // Key becomes: "trip:123:rider" in ConnectionStore
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type === 'trip_matched' | 'driver_location_update' | 'trip_started' | etc.
};
```

### Available channels

| Channel | ID format | Receives |
|---|---|---|
| `trip` | `{tripId}:rider` | trip_matched, trip_started, trip_completed, driver_location_update |
| `driver` | `{driverId}` | trip_assigned, location_update, trip_started, trip_completed |
| `user` | `{userId}` | notification |
| `support` | `all` | sos_alert |

### Heartbeat / keepalive

Send `{ type: "ping" }` periodically. Server responds with `{ type: "pong", timestamp: ... }`. If no pong received in 30s, reconnect.

---

## 9. Service Port Map

| Service | Port | Protocol | Public? |
|---|---|---|---|
| api-gateway | 3000 | HTTP | Yes (via Ingress) |
| websocket-server | 3001 | HTTP + WS | Yes (via Ingress) |
| location-service | 3002 | HTTP | No (internal only) |
| match-service | 3003 | HTTP | No (internal only) |
| auth-service | 4000 | HTTP | No (proxied via api-gateway) |
| trip-service | 4001 | HTTP | No (proxied via api-gateway) |
| payment-service | 4002 | HTTP | No (proxied via api-gateway) |
| admin-service | 4003 | HTTP | No (admin dashboard only) |
| NATS | 4222 | TCP | No (internal) |
| Redis Cluster | 6379-6381 | TCP | No (internal) |
| PostgreSQL (via PgBouncer) | 5432 | TCP | No (internal) |

### Health / readiness probes (Kubernetes uses these)

Every service exposes:
- `GET /health` → `{ status: "ok" }` — liveness probe (is the process alive?)
- `GET /ready` → `{ status: "ready" }` — readiness probe (is it connected to its dependencies?)
- `GET /metrics` → Prometheus text format — scraped by Prometheus every 15s

---

## 10. Integration Cheatsheet for Frontend / Mobile

### Authentication flow

```
POST https://api.911ainrider.com/auth/login
Body: { email, password }

Response: { accessToken, refreshToken, expiresIn }

→ Store accessToken in secure storage
→ Send as: Authorization: Bearer <accessToken> on all subsequent requests
→ When expired (401), call POST /auth/refresh with { refreshToken }
```

### Trip lifecycle (REST + WebSocket combined)

```
1. Connect WebSocket:
   wss://ws.911ainrider.com/ws
   Subscribe: { type: "subscribe", channel: "trip", id: "{tripId}:rider" }

2. Request trip:
   POST https://api.911ainrider.com/trips
   Body: { pickupLatitude, pickupLongitude, pickupAddress,
           dropoffLatitude, dropoffLongitude, dropoffAddress,
           paymentMethod: "CASH" | "CARD" | "WALLET" }
   → Response: { tripId, status: "REQUESTED" }

3. Wait for WebSocket events:
   { type: "trip_matched",   data: { tripId, driverId, estimatedArrival } }
   { type: "trip_started",   data: { tripId, driverId } }
   { type: "driver_location_update", data: { driverId, location: { lat, lng } } }
   { type: "trip_completed", data: { tripId, fare } }

4. Cancel (if needed):
   PATCH https://api.911ainrider.com/trips/{tripId}/cancel
   Body: { reason: "Changed my mind" }
```

### Driver availability flow

```
1. Connect WebSocket:
   wss://ws.911ainrider.com/ws
   Subscribe: { type: "subscribe", channel: "driver", id: "{driverId}" }

2. Go online (via location-service internal or through api-gateway proxy):
   POST /driver/available
   Body: { driverId, latitude, longitude, vehicleTypeId }

3. Send location updates every ~3 seconds while on a trip:
   POST /location/update
   Body: { driverId, latitude, longitude, heading, speed }

4. Wait for WebSocket events:
   { type: "trip_assigned",  data: { tripId, riderId, estimatedArrival } }
   { type: "trip_started",   data: { tripId } }
   { type: "trip_completed", data: { tripId } }
```

### Error response format (all services)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION",
    "message": "Invalid email format"
  },
  "timestamp": "2026-03-22T16:00:00.000Z"
}
```

### Common HTTP status codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Validation error / bad request |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate registration) |
| 422 | Business logic error (e.g. no drivers available) |
| 503 | Service temporarily unavailable |

---

## Summary

| Question | Answer |
|---|---|
| Why multiple NATS connections? | Each service is a separate process — they each need their own TCP connection to the same NATS cluster |
| Why multiple Redis clients? | Same reason — one client per process, all connecting to the same Redis Cluster |
| Does the frontend need to know about all services? | No — only `api-gateway` and `websocket-server` are publicly exposed |
| What happens when I scale to 3 pods? | Any pod handles any request; shared state in Redis/Postgres ensures consistency |
| How do WebSocket messages reach the right user when scaled? | NATS broadcasts to all websocket-server pods; each pod checks its local connection store |
| Where is TLS terminated? | At the Ingress (nginx) — services inside the cluster use plain HTTP |
| How does Kubernetes route to the right service? | Ingress rules match by hostname/path; kube-proxy load-balances across healthy pods |
