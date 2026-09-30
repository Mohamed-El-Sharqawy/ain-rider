# 911 Ain Rider — Complete Backend Architecture

Comprehensive technical documentation of the entire backend system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Infrastructure Layer](#3-infrastructure-layer)
4. [Service Architecture](#4-service-architecture)
5. [NATS Event System](#5-nats-event-system)
6. [Redis Data Layer](#6-redis-data-layer)
7. [Database Schema](#7-database-schema)
8. [API Gateway Routes](#8-api-gateway-routes)
9. [WebSocket Protocol](#9-websocket-protocol)
10. [Geospatial System (H3)](#10-geospatial-system-h3)
11. [Authentication Flow](#11-authentication-flow)
12. [Trip Lifecycle](#12-trip-lifecycle)
13. [Driver Matching Algorithm](#13-driver-matching-algorithm)
14. [Payment Flow](#14-payment-flow)
15. [Admin Operations](#15-admin-operations)
16. [Shared Packages](#16-shared-packages)
17. [Environment Configuration](#17-environment-configuration)
18. [Development Commands](#18-development-commands)

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Mobile App (React Native / Flutter)    │    Web Dashboard (React/Vue)          │
│  - Rider client                         │    - Admin panel                       │
│  - Driver client                        │    - Support dashboard                 │
└──────────────────────┬──────────────────┴────────────────┬──────────────────────┘
                       │                                    │
                       │ HTTPS/WSS                          │ HTTPS
                       ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENTRY POINT LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────┐         ┌─────────────────────────┐               │
│   │     API Gateway         │         │   WebSocket Server      │               │
│   │     :3000 (Elysia)      │         │     :3001 (Elysia)      │               │
│   │                         │         │                         │               │
│   │  • Rate limiting        │         │  • Real-time fanout     │               │
│   │  • JWT verification     │         │  • Connection store     │               │
│   │  • Cookie auth          │         │  • NATS subscriptions  │               │
│   │  • Request proxy        │         │  • Channel subscribe   │               │
│   └───────────┬─────────────┘         └───────────┬─────────────┘               │
│               │                                   │                              │
└───────────────┼───────────────────────────────────┼──────────────────────────────┘
                │                                   │
                │ HTTP Proxy                        │ NATS Subscribe
                ▼                                   │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          BUSINESS LOGIC LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ NestJS Services (CRUD + Business Rules) ─────────────────────────────────┐   │
│  │                                                                           │   │
│  │  auth-service:4000        trip-service:4001        payment-service:4002   │   │
│  │  • User registration      • Trip CRUD            • Payment CRUD          │   │
│  │  • Login/JWT              • Status transitions   • Cash collection       │   │
│  │  • User management        • Ratings              • Refunds                │   │
│  │  • Role-based data        • Cancellation         • Wallet (partial)       │   │
│  │                                                                           │   │
│  │  admin-service:4003                                                       │   │
│  │  • Cross-service commands    • User sync        • Settings management    │   │
│  │  • NATS request-reply        • Complaints       • Promo codes            │   │
│  │  • Multi-database access     • Notifications    • Vehicle management     │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─ Elysia Services (High-Throughput Async) ─────────────────────────────────┐   │
│  │                                                                           │   │
│  │  location-service:3002              match-service:3003                    │   │
│  │  • GPS updates (3s interval)       • Driver-rider matching               │   │
│  │  • H3 indexing                     • H3 ring expansion                   │   │
│  │  • TimescaleDB writes              • Available driver pool               │   │
│  │  • NATS publish                    • NATS pub/sub                         │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─ PostgreSQL (TimescaleDB) ────────┐  ┌─ Redis Cluster ─────────────────┐     │
│  │                                   │  │                                   │     │
│  │  ainrider_auth     (auth-svc)    │  │  Node 1-3: Masters (sharded)     │     │
│  │  ainrider_admin    (admin-svc)   │  │  Node 4-6: Replicas              │     │
│  │  ainrider_trip     (trip-svc)    │  │                                   │     │
│  │  ainrider_payment  (payment-svc) │  │  Keys:                            │     │
│  │  ainrider_location (location)   │  │  • location:driver:{id}          │     │
│  │                                   │  │  • match:h3:cell:{h3Index}      │     │
│  │  + PgBouncer (5 instances)        │  │  • match:driver:available:{id}  │     │
│  │    :5434-5438                     │  │  • api-gateway:{ip}:ratelimit  │     │
│  └───────────────────────────────────┘  └───────────────────────────────────┘     │
│                                                                                  │
│  ┌─ NATS JetStream ──────────────────┐  ┌─ MinIO ───────────────────────────┐    │
│  │                                   │  │                                   │    │
│  │  Stream: AIN_RIDER                │  │  Bucket: ain-rider                │    │
│  │  Subjects: ain_rider.>            │  │  • Profile images                 │    │
│  │  Retention: 7 days                │  │  • Document uploads               │    │
│  │  Storage: File-based              │  │  • Vehicle photos                 │    │
│  │                                   │  │  Port: 9000 (API) / 9001 (UI)     │    │
│  └───────────────────────────────────┘  └───────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow Summary

| Client Request | Entry Point | Processing | Response |
|----------------|-------------|------------|----------|
| Login/Register | API Gateway | auth-service | JWT in cookie |
| Create Trip | API Gateway | trip-service → NATS → match-service | Trip ID |
| Location Update | API Gateway | location-service → Redis → NATS → WS | Success |
| Real-time Events | WebSocket Server | NATS subscription | Push to client |
| Admin Commands | API Gateway | admin-service → NATS request-reply | Result |

---

## 2. Technology Stack

### Runtimes & Frameworks

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime (Elysia) | Bun | Latest | High-throughput services |
| Runtime (NestJS) | Node.js | 20+ | Business logic services |
| Web Framework | ElysiaJS | Latest | API Gateway, Location, Match, WS |
| Web Framework | NestJS | Latest | Auth, Trip, Payment, Admin |
| ORM | Prisma | Latest | Database access |
| Database | PostgreSQL + TimescaleDB | 17 | Persistent storage |
| Cache | Redis Cluster | 7.4 | Fast shared state |
| Message Broker | NATS JetStream | 2.10 | Async event streaming |
| Object Storage | MinIO | Latest | S3-compatible storage |

### Key Libraries

| Library | Usage |
|---------|-------|
| `h3-js` | Geospatial hexagonal indexing |
| `ioredis` | Redis cluster client |
| `nats` | NATS client library |
| `bcrypt` | Password hashing |
| `@nestjs/jwt` | JWT token generation |
| `prom-client` | Prometheus metrics |
| `elysia-rate-limit` | Request rate limiting |

---

## 3. Infrastructure Layer

### Docker Compose Services

```yaml
# From docker-compose.yml analysis

Services:
  postgres:                    # TimescaleDB HA
    image: timescale/timescaledb-ha:pg17-all-amd64
    port: 5433 (external) → 5432 (internal)
    databases:
      - ainrider_auth
      - ainrider_admin
      - ainrider_trip
      - ainrider_payment
      - ainrider_location

  pgbouncer-auth:              # Connection pooler
    port: 5434 → postgres:5432/ainrider_auth
    pool_mode: transaction
    max_client_conn: 500
    default_pool_size: 20

  pgbouncer-admin:             # port: 5435
  pgbouncer-trip:              # port: 5436
  pgbouncer-payment:           # port: 5437
  pgbouncer-location:          # port: 5438

  redis-1 to redis-6:          # Redis Cluster
    image: redis:7.4-alpine
    cluster-enabled: yes
    cluster-replicas: 1
    ports:
      - redis-1: 6379, 16379
      - redis-2: 6380, 16380
      - redis-3: 6381, 16381
      - redis-4: 6382, 16382
      - redis-5: 6383, 16383
      - redis-6: 6384, 16384

  nats:                        # NATS JetStream
    image: nats:2.10-alpine
    ports:
      - 4222 (client)
      - 8222 (monitoring)
    command: -js -m 8222

  minio:                       # Object Storage
    image: minio/minio:RELEASE.2025-02-28T09-55-16Z
    ports:
      - 9000 (API)
      - 9001 (Console)
    bucket: ain-rider
```

### Network Topology

```
┌─ ain-rider-net (bridge) ─────────────────────────────────────────┐
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐        │
│  │postgres │    │ redis-1 │    │ redis-2 │    │ redis-3 │        │
│  │ :5432   │    │ :6379   │    │ :6379   │    │ :6379   │        │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘        │
│       │              │              │              │              │
│       │         ┌────┴──────────────┴──────────────┴────┐        │
│       │         │         Redis Cluster                 │        │
│       │         └────────────────────────────────────────┘        │
│       │                                                           │
│  ┌────┴────┐    ┌─────────┐    ┌─────────┐                       │
│  │PgBouncer│    │  NATS   │    │  MinIO  │                       │
│  │×5       │    │ :4222   │    │ :9000   │                       │
│  └─────────┘    └─────────┘    └─────────┘                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Service Architecture

### Service Matrix

| Service | Framework | Port | Database | NATS Role | Redis | Public |
|---------|-----------|------|----------|-----------|-------|--------|
| api-gateway | Elysia | 3000 | - | - | Rate limit | Yes |
| websocket-server | Elysia | 3001 | - | Consumer | - | Yes |
| location-service | Elysia | 3002 | TimescaleDB | Publisher | H3 index | No |
| match-service | Elysia | 3003 | - | Pub/Sub | Driver pool | No |
| auth-service | NestJS | 4000 | ainrider_auth | Publisher | - | No |
| trip-service | NestJS | 4001 | ainrider_trip | Publisher | - | No |
| payment-service | NestJS | 4002 | ainrider_payment | Publisher | - | No |
| admin-service | NestJS | 4003 | Multi-DB | Requester | - | Admin only |

### Elysia Services Structure

```
apps/elysia/{service}/
├── src/
│   ├── index.ts              # Entry point, Elysia app setup
│   ├── modules/
│   │   ├── health/           # GET /health, /ready
│   │   ├── metrics/          # GET /metrics (Prometheus)
│   │   └── {business}/       # Business logic module
│   │       ├── index.ts      # Routes
│   │       ├── service.ts    # Business logic
│   │       └── model.ts      # Validation schemas
│   └── shared/
│       ├── nats.ts           # NATS connection singleton
│       ├── redis.ts          # Redis cluster client
│       ├── db.ts             # PostgreSQL pool (location only)
│       ├── logger.ts         # Structured logging
│       └── metrics.ts        # Prometheus metrics definitions
├── package.json
└── tsconfig.json
```

### NestJS Services Structure

```
apps/nest/{service}/
├── src/
│   ├── main.ts               # Entry point
│   ├── app.module.ts         # Module composition
│   ├── {domain}/
│   │   ├── {domain}.controller.ts
│   │   ├── {domain}.service.ts
│   │   └── dto/
│   ├── prisma/
│   │   ├── prisma.service.ts
│   │   └── schema.prisma
│   └── shared/
│       └── nats/
│           └── nats.service.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

---

## 5. NATS Event System

### Stream Configuration

```typescript
// From packages/nats-client/src/consumer.ts

Stream: AIN_RIDER
Subjects: ain_rider.>           // Wildcard - catches all events
Retention: Limits               // Delete old messages
Max Age: 7 days                 // 604,800,000,000,000 nanoseconds
Storage: File                   // Persistent on disk
Ack Policy: Explicit            // Consumer must acknowledge
```

### Event Subjects

```typescript
// From packages/shared-types/src/events.types.ts

export const NATS_SUBJECTS = {
  // User lifecycle
  USER_CREATED: 'ain_rider.user_created',
  USER_UPDATED: 'ain_rider.user_updated',
  USER_STATUS_CHANGED: 'ain_rider.user_status_changed',
  USER_DELETED: 'ain_rider.user_deleted',

  // Location & Trip
  LOCATION_UPDATE: 'ain_rider.location_update',
  TRIP_REQUESTED: 'ain_rider.trip_requested',
  TRIP_MATCHED: 'ain_rider.trip_matched',
  TRIP_STARTED: 'ain_rider.trip_started',
  TRIP_COMPLETED: 'ain_rider.trip_completed',
  TRIP_CANCELLED: 'ain_rider.trip_cancelled',

  // Driver
  DRIVER_STATUS_CHANGED: 'ain_rider.driver_status_changed',

  // Payment
  PAYMENT_PROCESSED: 'ain_rider.payment_processed',
  WALLET_UPDATED: 'ain_rider.wallet_updated',
  WITHDRAWAL_REQUESTED: 'ain_rider.withdrawal_requested',
  WITHDRAWAL_PROCESSED: 'ain_rider.withdrawal_processed',

  // Safety
  SOS_CREATED: 'ain_rider.sos_created',
  SOS_RESOLVED: 'ain_rider.sos_resolved',

  // Support
  COMPLAINT_CREATED: 'ain_rider.complaint_created',
  COMPLAINT_UPDATED: 'ain_rider.complaint_updated',

  // Notification
  NOTIFICATION_SENT: 'ain_rider.notification_sent',

  // Promo
  PROMO_USED: 'ain_rider.promo_used',
} as const;
```

### Request-Reply Subjects

```typescript
export const NATS_REQUESTS = {
  // Trip commands (admin-service → trip-service)
  TRIP_CREATE: 'trip.create.request',
  TRIP_CANCEL: 'trip.cancel.request',
  TRIP_ASSIGN_DRIVER: 'trip.assign_driver.request',
  TRIP_UPDATE_STATUS: 'trip.update_status.request',

  // Payment commands (admin-service → payment-service)
  PAYMENT_REFUND: 'payment.refund.request',
  PAYMENT_ADJUST: 'payment.adjust.request',

  // User commands (admin-service → auth-service)
  USER_SUSPEND: 'user.suspend.request',
  USER_ACTIVATE: 'user.activate.request',
  USER_UPDATE: 'user.update.request',
} as const;
```

### Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NATS Event Flow                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER_CREATED                                                                │
│  ┌─────────────┐                                                            │
│  │auth-service │ ──publish──► ain_rider.user_created                        │
│  └─────────────┘                     │                                      │
│                                       ├──► admin-service (sync shadow table) │
│                                       └──► (future subscribers)              │
│                                                                              │
│  TRIP_REQUESTED                                                              │
│  ┌─────────────┐                                                            │
│  │trip-service │ ──publish──► ain_rider.trip_requested                      │
│  └─────────────┘                     │                                      │
│                                       └──► match-service (find driver)      │
│                                              │                               │
│  TRIP_MATCHED                                 │                              │
│  ┌─────────────┐                              ▼                              │
│  │match-service│ ──publish──► ain_rider.trip_matched                        │
│  └─────────────┘                     │                                      │
│                                       ├──► websocket-server (notify rider)  │
│                                       ├──► websocket-server (notify driver) │
│                                       └──► trip-service (update status)     │
│                                                                              │
│  LOCATION_UPDATE                                                              │
│  ┌────────────────┐                                                         │
│  │location-service│ ──publish──► ain_rider.location_update                  │
│  └────────────────┘                     │                                   │
│                                         └──► websocket-server (fanout)      │
│                                                                              │
│  PAYMENT_PROCESSED                                                           │
│  ┌────────────────┐                                                         │
│  │payment-service │ ──publish──► ain_rider.payment_processed                │
│  └────────────────┘                     │                                   │
│                                         └──► websocket-server (notify)      │
│                                                                              │
│  SOS_CREATED                                                                 │
│  ┌─────────────┐                                                            │
│  │trip-service │ ──publish──► ain_rider.sos_created                          │
│  └─────────────┘                     │                                      │
│                                       └──► websocket-server (support:all)   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Publisher Implementation

```typescript
// From packages/nats-client/src/publisher.ts

export class NatsPublisher {
  private js: JetStreamClient;

  async publish<T extends NatsEvent>(event: T): Promise<void> {
    const payload = JSON.stringify(event.data);
    await this.js.publish(event.subject, new TextEncoder().encode(payload));
  }

  async publishBatch(events: NatsEvent[]): Promise<void> {
    await Promise.all(events.map(e => this.publish(e)));
  }
}
```

### Consumer Implementation

```typescript
// From packages/nats-client/src/consumer.ts

export class NatsConsumer {
  async subscribe<T>(subject: string, handler: MessageHandler<T>): Promise<void> {
    // 1. Ensure stream exists (creates if not)
    await this.ensureStream('AIN_RIDER', [subject]);

    // 2. Ensure consumer exists (creates durable consumer)
    await this.ensureConsumer('AIN_RIDER', consumerName, subject);

    // 3. Consume messages
    for await (const msg of messages) {
      const data = JSON.parse(new TextDecoder().decode(msg.data));
      await handler(data, msg);
      msg.ack();  // Explicit acknowledgment
    }
  }
}
```

---

## 6. Redis Data Layer

### Cluster Configuration

```typescript
// From packages/redis-client/src/cluster.ts

export function createRedisCluster(config: RedisClusterConfig): Cluster {
  const options: ClusterOptions = {
    natMap: {
      // Development NAT mapping
      'ain-rider-redis-1:6379': { host: '127.0.0.1', port: 6379 },
      'ain-rider-redis-2:6379': { host: '127.0.0.1', port: 6380 },
      'ain-rider-redis-3:6379': { host: '127.0.0.1', port: 6381 },
      'ain-rider-redis-4:6379': { host: '127.0.0.1', port: 6382 },
      'ain-rider-redis-5:6379': { host: '127.0.0.1', port: 6383 },
      'ain-rider-redis-6:6379': { host: '127.0.0.1', port: 6384 },
    },
    redisOptions: {
      keyPrefix: config.keyPrefix,  // Service-specific prefix
      maxRetriesPerRequest: 3,
    },
    clusterRetryStrategy: (times) => Math.min(100 + times * 100, 2000),
  };

  return new Redis.Cluster(nodes, options);
}
```

### Key Patterns by Service

| Service | Prefix | Key Pattern | Purpose | TTL |
|---------|--------|-------------|---------|-----|
| location-service | `location:` | `driver:location:{driverId}` | Current GPS position | 5 min |
| location-service | `location:` | `h3:drivers:{h3Index}` | Drivers in H3 cell | 5 min |
| match-service | `match:` | `h3:cell:{h3Index}` | Available drivers per cell | 5 min |
| match-service | `match:` | `driver:available:{driverId}` | Driver availability record | 5 min |
| api-gateway | `api-gateway:` | `{ip}:ratelimit` | Request count per IP | 1 min |

### Cache Wrapper

```typescript
// From packages/redis-client/src/cache.ts

export class RedisCache {
  async get<T>(key: string): Promise<T | null> {
    const value = await this.cluster.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.cluster.setex(key, ttlSeconds, serialized);
    } else {
      await this.cluster.set(key, serialized);
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> { ... }
  async mset(entries: Record<string, any>, ttl?: number): Promise<void> { ... }
  async increment(key: string, by: number): Promise<number> { ... }
}
```

### Location Service Redis Operations

```typescript
// From apps/elysia/location-service/src/modules/location/service.ts

// Atomic update: remove old H3, add new, set position
const pipeline = redisCluster.pipeline();
if (prevLocation?.h3Index && prevLocation.h3Index !== h3Index) {
  pipeline.srem(`h3:drivers:${prevLocation.h3Index}`, driverId);
}
pipeline.sadd(`h3:drivers:${h3Index}`, driverId);
pipeline.setex(`driver:location:${driverId}`, 300, JSON.stringify(locationUpdate));
await pipeline.exec();
```

---

## 7. Database Schema

### Auth Service Schema

```prisma
// apps/nest/auth-service/prisma/schema.prisma

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  phoneNumber  String   @unique
  passwordHash String
  firstName    String
  lastName     String
  role         String   // RIDER, DRIVER, ADMIN, SUPPORT
  status       String   @default("ACTIVE") // ACTIVE, INACTIVE, SUSPENDED, BANNED
  profileImage String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}

model Driver {
  id            String   @id @default(uuid())
  userId        String   @unique
  vehicleId     String?
  licenseNumber String   @unique
  rating        Float    @default(5.0)
  totalTrips    Int      @default(0)
  isOnline      Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("drivers")
}

model Rider {
  id         String   @id @default(uuid())
  userId     String   @unique
  rating     Float    @default(5.0)
  totalTrips Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("riders")
}
```

### Trip Service Schema

```prisma
// apps/nest/trip-service/prisma/schema.prisma

model Trip {
  id                 String    @id @default(uuid())
  riderId            String
  driverId           String?
  status             String    @default("REQUESTED")
  pickupLat          Float
  pickupLng          Float
  pickupAddress      String
  dropoffLat         Float
  dropoffLng         Float
  dropoffAddress     String
  estimatedFare      Float
  actualFare         Float?
  paymentMethod      String    @default("CASH")
  paymentStatus      String    @default("PENDING")
  promoCode          String?
  promoDiscount      Float     @default(0)
  distance           Float?
  duration           Int?
  requestedAt        DateTime  @default(now())
  matchedAt          DateTime?
  startedAt          DateTime?
  completedAt        DateTime?
  cancelledAt        DateTime?
  cancellationReason String?
  cancelledBy        String?
  driverRating       Float?
  riderRating        Float?
  updatedAt          DateTime  @updatedAt

  @@index([riderId])
  @@index([driverId])
  @@index([status])
  @@index([paymentStatus])
  @@index([requestedAt])
  @@map("trips")
}
```

### Payment Service Schema

```prisma
// apps/nest/payment-service/prisma/schema.prisma

model Payment {
  id              String   @id @default(uuid())
  tripId          String   @unique
  riderId         String
  driverId        String
  amount          Float
  currency        String   @default("IQD")
  paymentMethod   String
  status          String   // PENDING, COMPLETED, FAILED, REFUNDED
  transactionId   String?
  gatewayResponse Json?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("payments")
}

model Refund {
  id        String   @id @default(uuid())
  paymentId String
  amount    Float
  reason    String
  status    String   // PENDING, PROCESSED, FAILED
  createdAt DateTime @default(now())

  @@map("refunds")
}
```

### Location Service (TimescaleDB)

```sql
-- Hypertable for GPS history
CREATE TABLE driver_locations (
  id           SERIAL,
  driver_id    VARCHAR(36) NOT NULL,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  h3_index     VARCHAR(20) NOT NULL,
  heading      DOUBLE PRECISION,
  speed        DOUBLE PRECISION,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('driver_locations', 'recorded_at');

-- Indexes for fast queries
CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id, recorded_at DESC);
CREATE INDEX idx_driver_locations_h3 ON driver_locations(h3_index, recorded_at);
```

---

## 8. API Gateway Routes

### Route Definitions

```typescript
// From apps/elysia/api-gateway/src/index.ts

const app = new Elysia()
  .use(cookie())
  .use(cors({ credentials: true }))
  .use(swagger({ title: '911 Ain Rider API Gateway' }))
  .use(rateLimit({ duration: 60_000, max: 100 }))
  .use(health)      // GET /health, /ready
  .use(metrics)     // GET /metrics
  .use(auth)        // /auth/*
  .use(trips)       // /trips/*
  .use(admin)       // /admin/*
  .listen(3000);
```

### Auth Routes

```typescript
// From apps/elysia/api-gateway/src/modules/auth/index.ts

POST /auth/login
  Body: { email: string, password: string }
  Response: { user: User, success: true }
  Side effect: Sets accessToken & refreshToken cookies

POST /auth/register
  Body: { email, password, phoneNumber, firstName, lastName, role }
  Response: { user: User, success: true }
  Side effect: Sets cookies, publishes USER_CREATED

POST /auth/refresh
  Cookie: refreshToken
  Response: { success: true }
  Side effect: Sets new accessToken

POST /auth/logout
  Response: { success: true }
  Side effect: Clears cookies

GET /auth/me
  Cookie: accessToken
  Response: { user: User }
```

### Trip Routes

```typescript
// From apps/elysia/api-gateway/src/modules/trips/index.ts

POST /trips
  Auth: Required (JWT)
  Body: {
    riderId: string,
    pickupLat: number,
    pickupLng: number,
    pickupAddress: string,
    dropoffLat: number,
    dropoffLng: number,
    dropoffAddress: string,
    estimatedFare: number,
    paymentMethod?: "CASH" | "CARD" | "WALLET",
    promoCode?: string
  }
  Response: { trip: Trip }
  Side effect: Publishes TRIP_REQUESTED

GET /trips/:id
  Auth: Required
  Response: { trip: Trip }

PATCH /trips/:id/cancel
  Auth: Required
  Body: { reason: string }
  Response: { trip: Trip }
  Side effect: Publishes TRIP_CANCELLED
```

### Admin Routes

```typescript
// From apps/elysia/api-gateway/src/modules/admin/index.ts

GET /admin/users
  Auth: Admin role
  Query: { role?, status?, page?, limit? }
  Response: { users: User[], total: number }

GET /admin/users/:id
  Auth: Admin role
  Response: { user: User, roleData?: Driver | Rider }

PATCH /admin/users/:id/status
  Auth: Admin role
  Body: { status: string, reason?: string }
  Response: { success: true }
  Side effect: NATS request to auth-service

GET /admin/trips
  Auth: Admin role
  Query: { status?, riderId?, driverId?, from?, to? }
  Response: { trips: Trip[], total: number }

GET /admin/settings
  Auth: Admin role
  Response: { settings: Setting[] }

PATCH /admin/settings
  Auth: Admin role
  Body: { settings: { key: string, value: string }[] }
  Response: { success: true }
```

### Location Routes

```typescript
// From apps/elysia/location-service/src/modules/location/index.ts

POST /location/update
  Body: {
    driverId: string,
    latitude: number,
    longitude: number,
    heading?: number,
    speed?: number
  }
  Response: { success: boolean, h3Index: string }
  Side effect: Redis update, TimescaleDB insert, NATS publish

GET /location/nearby
  Query: { latitude: number, longitude: number }
  Response: {
    drivers: { driverId, latitude, longitude, h3Index }[],
    centerH3: string,
    count: number
  }

GET /location/history/:driverId
  Query: { from: string, to?: string }
  Response: { latitude, longitude, recordedAt }[]
```

### Match Routes

```typescript
// From apps/elysia/match-service/src/modules/match/index.ts

POST /match/available
  Body: {
    driverId: string,
    latitude: number,
    longitude: number,
    vehicleTypeId: string
  }
  Response: { h3Index: string }
  Side effect: Adds to Redis available pool

DELETE /match/available/:driverId
  Response: { success: true }
  Side effect: Removes from available pool

GET /match/available
  Query: { h3Index?: string }
  Response: { drivers: AvailableDriver[], count: number }
```

---

## 9. WebSocket Protocol

### Connection Flow

```typescript
// From apps/elysia/websocket-server/src/modules/realtime/index.ts

// 1. Client connects
ws://localhost:3001/ws

// 2. Client sends subscription
{
  "type": "subscribe",
  "channel": "trip",      // trip | driver | user | support
  "id": "123:rider"       // Channel-specific identifier
}

// 3. Server stores connection
ConnectionStore.set("trip:123:rider", ws)

// 4. Server sends events
{
  "type": "trip_matched",
  "data": { tripId: "...", driverId: "...", estimatedArrival: 300 }
}
```

### Connection Store

```typescript
// From apps/elysia/websocket-server/src/shared/connections.ts

export abstract class ConnectionStore {
  private static store = new Map<string, ServerWebSocket<WsData>>();

  static set(key: string, ws: ServerWebSocket<WsData>): void;
  static get(key: string): ServerWebSocket<WsData> | undefined;
  static delete(key: string): void;
  static deleteByWs(ws: ServerWebSocket<WsData>): void;
  static send(key: string, payload: unknown): boolean;
  static size(): number;
}
```

### Channel Types

| Channel | ID Format | Receives Events |
|---------|-----------|-----------------|
| `trip` | `{tripId}:rider` | `trip_matched`, `trip_started`, `trip_completed`, `driver_location_update` |
| `driver` | `{driverId}` | `trip_assigned`, `location_update`, `trip_started`, `trip_completed` |
| `user` | `{userId}` | `notification` |
| `support` | `all` | `sos_alert` |

### NATS to WebSocket Mapping

```typescript
// From apps/elysia/websocket-server/src/modules/realtime/service.ts

// LOCATION_UPDATE
consumer.subscribe(LOCATION_UPDATE, (data) => {
  ConnectionStore.send(`driver:${data.driverId}`, { type: 'location_update', data });
  ConnectionStore.send(`trip:${data.driverId}:rider`, { type: 'driver_location_update', data });
});

// TRIP_MATCHED
consumer.subscribe(TRIP_MATCHED, (data) => {
  ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_matched', data });
  ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_assigned', data });
});

// TRIP_STARTED
consumer.subscribe(TRIP_STARTED, (data) => {
  ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_started', data });
  ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_started', data });
});

// TRIP_COMPLETED
consumer.subscribe(TRIP_COMPLETED, (data) => {
  ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_completed', data });
  ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_completed', data });
});

// NOTIFICATION_SENT
consumer.subscribe(NOTIFICATION_SENT, (data) => {
  ConnectionStore.send(`user:${data.userId}`, { type: 'notification', data });
});

// SOS_CREATED
consumer.subscribe(SOS_CREATED, (data) => {
  ConnectionStore.send(`support:all`, { type: 'sos_alert', data });
});
```

### Heartbeat Protocol

```typescript
// Client sends
{ "type": "ping" }

// Server responds
{ "type": "pong", "timestamp": "2026-03-24T10:00:00.000Z" }

// If no pong in 30s, client should reconnect
```

---

## 10. Geospatial System (H3)

### H3 Configuration

```typescript
// Resolution 9 = ~0.1 km² per cell
const H3_RESOLUTION = 9;
const H3_RESOLUTION_DISPATCH = 9;
```

### Resolution Reference

| Resolution | Cell Area | Cell Edge | Use Case |
|------------|-----------|-----------|----------|
| 9 | ~0.1 km² | ~500m | Driver dispatch |
| 10 | ~0.03 km² | ~250m | Precise pickup |
| 11 | ~0.01 km² | ~120m | Walking navigation |

### Location Service H3 Operations

```typescript
// From apps/elysia/location-service/src/modules/location/service.ts

// Convert lat/lng to H3 index
const h3Index = latLngToCell(latitude, longitude, H3_RESOLUTION_DISPATCH);

// Store driver in H3 cell
await redisCluster.sadd(`h3:drivers:${h3Index}`, driverId);

// Store position with TTL
await redisCluster.setex(`driver:location:${driverId}`, 300, JSON.stringify(locationUpdate));

// Query nearby drivers from same cell
SELECT DISTINCT ON (driver_id) driver_id, latitude, longitude, h3_index
FROM driver_locations
WHERE h3_index = $1
  AND recorded_at > NOW() - INTERVAL '5 minutes'
ORDER BY driver_id, recorded_at DESC
```

### Match Service H3 Operations

```typescript
// From apps/elysia/match-service/src/modules/match/service.ts

// Get pickup H3
const centerH3 = latLngToCell(pickupLat, pickupLng, H3_RESOLUTION);

// k=1 ring: center + 6 neighbors = 7 cells
let candidates = await getCandidates(gridDisk(centerH3, 1));

// Expand to k=2 if not enough drivers
if (candidates.length < 3) {
  candidates = await getCandidates(gridDisk(centerH3, 2));
}

// Get drivers from multiple cells
private static async getCandidates(cells: string[]): Promise<AvailableDriver[]> {
  const results: AvailableDriver[] = [];
  await Promise.all(cells.map(async (cell) => {
    const drivers = await cache.get<AvailableDriver[]>(`h3:cell:${cell}`) ?? [];
    results.push(...drivers);
  }));
  return results;
}
```

---

## 11. Authentication Flow

### Registration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ API Gateway │     │auth-service │     │    NATS     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ POST /auth/register                  │                   │
       │──────────────────►│                   │                   │
       │                   │ Proxy to auth-svc │                   │
       │                   │──────────────────►│                   │
       │                   │                   │ Create User       │
       │                   │                   │ Create Driver/Rider                  │
       │                   │                   │                   │
       │                   │                   │ Publish USER_CREATED               │
       │                   │                   │──────────────────►│
       │                   │                   │                   │──► admin-service
       │                   │                   │                   │    (sync shadow)
       │                   │                   │                   │
       │                   │                   │ Generate JWTs     │
       │                   │◄──────────────────│                   │
       │                   │ Set cookies       │                   │
       │◄──────────────────│ Return user       │                   │
       │                   │                   │                   │
```

### Login Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ API Gateway │     │auth-service │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /auth/login  │                   │
       │ { email, password }                   │
       │──────────────────►│                   │
       │                   │ Proxy             │
       │                   │──────────────────►│
       │                   │                   │ Find user by email
       │                   │                   │ bcrypt.compare(password, hash)
       │                   │                   │ Generate access + refresh tokens
       │                   │◄──────────────────│
       │                   │ Set httpOnly cookies                  │
       │◄──────────────────│ { user, success } │
       │                   │                   │
```

### JWT Token Structure

```typescript
// From apps/nest/auth-service/src/auth/auth.service.ts

// Access Token (15 min)
{
  sub: userId,
  email: user.email,
  role: "RIDER" | "DRIVER" | "ADMIN" | "SUPPORT",
  type: "access"
}
expiresIn: "15m"

// Refresh Token (7 days)
{
  sub: userId,
  email: user.email,
  role: string,
  type: "refresh"
}
expiresIn: "7d"
```

### Cookie Configuration

```typescript
// From apps/elysia/api-gateway/src/modules/auth/index.ts

accessToken.set({
  httpOnly: true,
  secure: isProduction,      // true in prod
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 15 * 60,           // 15 minutes
  path: '/'
});

refreshToken.set({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60,  // 7 days
  path: '/'
});
```

---

## 12. Trip Lifecycle

### Status Transitions

```
REQUESTED ──► MATCHED ──► IN_PROGRESS ──► COMPLETED
    │            │             │
    │            │             └──► CANCELLED
    │            └──► CANCELLED
    └──► CANCELLED (no driver found)
```

### Complete Trip Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Trip Request Flow                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. REQUEST                                                                  │
│  ┌─────────┐    POST /trips    ┌────────────┐    create    ┌────────────┐  │
│  │  Rider  │ ─────────────────► │API Gateway │ ──────────► │trip-service│  │
│  │  App    │                    └────────────┘             └─────┬──────┘  │
│  └─────────┘                                                     │          │
│                                                                   │          │
│  2. PUBLISH EVENT                                                 │          │
│  ┌────────────┐    publish     ┌──────┐                          │          │
│  │trip-service│ ─────────────►│ NATS │◄─────────────────────────┘          │
│  └────────────┘   trip.requested                                      │      │
│                                                                         │      │
│  3. MATCH                                                               │      │
│  ┌────────────┐    consume     ┌──────┐                                │      │
│  │match-service│ ◄─────────────│ NATS │                                │      │
│  └──────┬─────┘                └──────┘                                │      │
│         │                                                              │      │
│         │ H3 ring search in Redis                                      │      │
│         │ Select nearest driver                                        │      │
│         │                                                              │      │
│         │ publish trip.matched                                         │      │
│         └──────────────────────────────────────────────────────────────┼───►│
│                                                                         │      │
│  4. NOTIFY                                                              │      │
│  ┌─────────────────┐    consume    ┌──────┐                            │      │
│  │websocket-server │ ◄─────────────│ NATS │◄───────────────────────────┘      │
│  └────────┬────────┘               └──────┘                                   │
│           │                                                                    │
│           │ send to trip:123:rider → { type: "trip_matched" }                 │
│           │ send to driver:456 → { type: "trip_assigned" }                     │
│           │                                                                    │
│  5. UPDATE STATUS                                                             │
│  ┌────────────┐    consume    ┌──────┐                                        │
│  │trip-service│ ◄─────────────│ NATS │                                        │
│  └──────┬─────┘               └──────┘                                        │
│         │                                                                      │
│         │ UPDATE trips SET status = 'MATCHED', driverId = ?, matchedAt = NOW()│
│         │                                                                      │
│  6. IN_PROGRESS (driver arrives, rider boards)                                │
│  ┌─────────┐    PATCH /trips/:id/status    ┌────────────┐                     │
│  │ Driver  │ ─────────────────────────────►│trip-service│                     │
│  │  App    │    { status: "IN_PROGRESS" }   └─────┬──────┘                     │
│  └─────────┘                                       │                           │
│                                                    │ publish trip.started      │
│                                                    └───────────────────────────►│
│                                                                                │
│  7. COMPLETED                                                                  │
│  ┌─────────┐    PATCH /trips/:id/status    ┌────────────┐                     │
│  │ Driver  │ ─────────────────────────────►│trip-service│                     │
│  │  App    │    { status: "COMPLETED",      └─────┬──────┘                     │
│  └─────────┘      actualFare, distance }          │                           │
│                                                    │ publish trip.completed    │
│                                                    └───────────────────────────►│
│                                                                                │
│  8. PAYMENT                                                                   │
│  ┌─────────────────┐    consume    ┌──────┐                                   │
│  │payment-service  │ ◄─────────────│ NATS │                                   │
│  └─────────────────┘               └──────┘                                   │
│         │                                                                      │
│         │ Create Payment record                                               │
│         │ For CASH: driver confirms collection                                │
│         │ publish payment.processed                                           │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Driver Matching Algorithm

### Algorithm Steps

```typescript
// From apps/elysia/match-service/src/modules/match/service.ts

1. Receive TRIP_REQUESTED event
   ↓
2. Convert pickup location to H3 index (resolution 9)
   const centerH3 = latLngToCell(pickupLat, pickupLng, 9);
   ↓
3. Search k=1 ring (7 cells: center + 6 neighbors)
   const candidates = await getCandidates(gridDisk(centerH3, 1));
   ↓
4. If candidates < MIN_CANDIDATES (3), expand to k=2
   // k=2 = 19 cells total
   if (candidates.length < 3) {
     candidates = await getCandidates(gridDisk(centerH3, 2));
   }
   ↓
5. If no candidates, log warning and exit
   ↓
6. Select first available driver
   // TODO: Implement ranking by ETA, rating, acceptance rate
   const selected = candidates[0];
   ↓
7. Publish TRIP_MATCHED event
   await publisher.publish({
     subject: TRIP_MATCHED,
     data: { tripId, driverId: selected.driverId, estimatedArrival: 300 }
   });
   ↓
8. Remove driver from available pool
   await unregisterDriver(selected.driverId);
```

### Available Driver Pool

```typescript
// Redis structure for available drivers

// Per-cell list (for fast proximity search)
Key: match:h3:cell:{h3Index}
Value: [
  { driverId, latitude, longitude, vehicleTypeId, h3Index, availableSince },
  ...
]
TTL: 300 seconds (5 minutes)

// Per-driver record (for fast unregister)
Key: match:driver:available:{driverId}
Value: { driverId, latitude, longitude, vehicleTypeId, h3Index, availableSince }
TTL: 300 seconds
```

### Driver Registration

```typescript
// Register as available
POST /match/available
{
  driverId: string,
  latitude: number,
  longitude: number,
  vehicleTypeId: string
}

// Process:
1. Compute h3Index from lat/lng
2. Add to h3:cell:{h3Index} list
3. Set driver:available:{driverId} record
4. Both with 5-minute TTL
```

---

## 14. Payment Flow

### Payment Methods

| Method | Flow | Confirmation |
|--------|------|--------------|
| CASH | Create PENDING → Driver collects → Confirm | Driver app |
| CARD | Create PENDING → Gateway charge → Complete | Auto |
| WALLET | Check balance → Deduct → Complete | Auto |

### Cash Payment Flow

```typescript
// From apps/nest/payment-service/src/payments/payments.service.ts

// 1. Create payment (trip completed)
async createPayment({ tripId, riderId, driverId, amount, paymentMethod }) {
  const payment = await prisma.payment.create({
    data: {
      tripId, riderId, driverId, amount,
      currency: 'IQD',
      status: 'PENDING',
      paymentMethod: 'CASH'
    }
  });
  return payment;
}

// 2. Driver confirms cash collection
async confirmCashCollection(paymentId, collectedBy) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      transactionId: `cash_${Date.now()}`,
      gatewayResponse: { collectedBy, method: 'CASH' }
    }
  });

  // Notify via NATS
  await nats.publisher.publish({
    subject: PAYMENT_PROCESSED,
    data: { tripId, paymentId, amount, status: 'COMPLETED', paymentMethod: 'CASH' }
  });

  return payment;
}
```

### Refund Flow

```typescript
async createRefund(paymentId, amount, reason) {
  const refund = await prisma.refund.create({
    data: { paymentId, amount, reason, status: 'PENDING' }
  });
  // Admin processes refund manually
  return refund;
}
```

---

## 15. Admin Operations

### Multi-Database Access

```typescript
// admin-service connects to multiple databases

// From apps/nest/admin-service/src/prisma/

auth-db.service.ts    → ainrider_auth (via auth-prisma client)
trip-db.service.ts    → ainrider_trip (via trip-prisma client)
prisma.service.ts     → ainrider_admin (own database)
```

### NATS Request-Reply Pattern

```typescript
// From apps/nest/admin-service/src/users/users.service.ts

async updateStatus(userId, status, reason, updatedBy) {
  // Send command to auth-service, wait for response
  const response = await this.nats.requester.request(
    'ain_rider.user.update_status',
    { userId, status, reason, updatedBy, previousStatus: user.status }
  );
  return { success: true, message: 'Status update request sent' };
}
```

### User Sync Service

```typescript
// From apps/nest/admin-service/src/shared/nats/user-sync.service.ts

// Listens for USER_CREATED, USER_UPDATED, USER_STATUS_CHANGED
// Updates shadow table in admin database for fast queries

@OnEvent('user.created')
async handleUserCreated(data: UserCreatedEvent) {
  await this.prisma.userShadow.upsert({
    where: { id: data.id },
    create: { ...data },
    update: { ...data }
  });
}
```

### Admin Service Modules

| Module | Purpose | Database |
|--------|---------|----------|
| users | User management, status changes | auth-db |
| trips | Trip queries, driver assignment | trip-db |
| wallets | Wallet balance, withdrawals | trip-db |
| vehicles | Vehicle CRUD | auth-db |
| promos | Promo code management | admin-db |
| settings | System configuration | admin-db |
| complaints | Support tickets | admin-db |
| notifications | Broadcast notifications | admin-db |
| profile | Admin profile management | admin-db |

---

## 16. Shared Packages

### Package Structure

```
packages/
├── nats-client/
│   ├── src/
│   │   ├── index.ts        # Exports
│   │   ├── connection.ts   # createNatsConnection()
│   │   ├── publisher.ts    # NatsPublisher class
│   │   ├── consumer.ts     # NatsConsumer class
│   │   └── responder.ts    # NatsResponder (request-reply)
│   └── package.json
│
├── redis-client/
│   ├── src/
│   │   ├── index.ts        # Exports
│   │   ├── cluster.ts      # createRedisCluster()
│   │   └── cache.ts        # RedisCache class
│   └── package.json
│
└── shared-types/
    ├── src/
    │   ├── index.ts        # Exports
    │   ├── events.types.ts # NATS subjects & event interfaces
    │   ├── location.types.ts
    │   ├── trip.types.ts
    │   └── user.types.ts
    └── package.json
```

### nats-client Usage

```typescript
// Connection
import { createNatsConnection } from '@ain-rider/nats-client';

const nc = await createNatsConnection({
  url: 'nats://localhost:4222',
  name: 'my-service',
  maxReconnectAttempts: -1,  // infinite
  reconnectTimeWait: 2000    // 2 seconds
});

// Publisher
import { createPublisher } from '@ain-rider/nats-client';
const publisher = createPublisher(nc);
await publisher.publish({ subject: 'ain_rider.trip_requested', data: {...} });

// Consumer
import { createConsumer } from '@ain-rider/nats-client';
const consumer = createConsumer(nc);
await consumer.subscribe('ain_rider.trip_requested', async (data, msg) => {
  // Process message
  msg.ack();  // or msg.nak() to retry
});

// Responder (request-reply)
import { createResponder } from '@ain-rider/nats-client';
const responder = createResponder(nc);
await responder.respond('user.suspend.request', async (data) => {
  // Process and return response
  return { success: true };
});
```

### redis-client Usage

```typescript
// Cluster
import { createRedisCluster, createCache } from '@ain-rider/redis-client';

const cluster = createRedisCluster({
  nodes: ['localhost:6379', 'localhost:6380', 'localhost:6381'],
  password: 'optional',
  keyPrefix: 'my-service:'
});

const cache = createCache(cluster);

// Cache operations
await cache.set('key', { data: 'value' }, 300);  // 5 min TTL
const data = await cache.get('key');
await cache.del('key');
await cache.increment('counter', 1);
```

### shared-types Usage

```typescript
import { NATS_SUBJECTS, TripStatus, UserRole, type TripRequestedEvent } from '@ain-rider/shared-types';

// Use constants
await publisher.publish({
  subject: NATS_SUBJECTS.TRIP_REQUESTED,
  data: { ... }
});

// Use types
const event: TripRequestedEvent = {
  subject: NATS_SUBJECTS.TRIP_REQUESTED,
  data: { tripId: '...', riderId: '...', ... }
};

// Use enums
if (trip.status === TripStatus.MATCHED) { ... }
if (user.role === UserRole.DRIVER) { ... }
```

---

## 17. Environment Configuration

### Required Environment Variables

```bash
# .env.example

# Service Ports
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001
LOCATION_SERVICE_PORT=3002
MATCH_SERVICE_PORT=3003

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# PostgreSQL (via PgBouncer)
DATABASE_URL=postgresql://ainrider:password@localhost:5434/ainrider_auth

# Redis Cluster
REDIS_NODES=localhost:6379,localhost:6380,localhost:6381

# NATS
NATS_URL=nats://localhost:4222

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=15m

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=ain-rider

# Node Environment
NODE_ENV=development
```

### Service-Specific Database URLs

```bash
# auth-service
DATABASE_URL=postgresql://ainrider:password@localhost:5434/ainrider_auth

# trip-service
DATABASE_URL=postgresql://ainrider:password@localhost:5436/ainrider_trip

# payment-service
DATABASE_URL=postgresql://ainrider:password@localhost:5437/ainrider_payment

# admin-service (multiple)
AUTH_DATABASE_URL=postgresql://ainrider:password@localhost:5434/ainrider_auth
TRIP_DATABASE_URL=postgresql://ainrider:password@localhost:5436/ainrider_trip
ADMIN_DATABASE_URL=postgresql://ainrider:password@localhost:5435/ainrider_admin

# location-service (direct PostgreSQL for TimescaleDB)
DATABASE_URL=postgresql://ainrider:password@localhost:5438/ainrider_location
```

---

## 18. Development Commands

### Infrastructure

```bash
# Start all infrastructure services
docker compose up -d

# Initialize Redis cluster (first run only)
docker compose run --rm redis-cluster-init

# Initialize MinIO bucket (first run only)
docker compose run --rm minio-init

# Check service health
docker compose ps
docker compose logs -f postgres
docker compose logs -f nats

# Redis cluster status
docker exec -it ain-rider-redis-1 redis-cli cluster info
docker exec -it ain-rider-redis-1 redis-cli cluster nodes

# NATS status
curl http://localhost:8222/healthz
curl http://localhost:8222/varz
```

### Services

```bash
# Elysia services (from project root)
cd apps/elysia/api-gateway && bun run dev
cd apps/elysia/websocket-server && bun run dev
cd apps/elysia/location-service && bun run dev
cd apps/elysia/match-service && bun run dev

# NestJS services
cd apps/nest/auth-service && pnpm run start:dev
cd apps/nest/trip-service && pnpm run start:dev
cd apps/nest/payment-service && pnpm run start:dev
cd apps/nest/admin-service && pnpm run start:dev
```

### Database

```bash
# Prisma operations
cd apps/nest/auth-service && npx prisma db push
cd apps/nest/auth-service && npx prisma studio

# Generate Prisma clients
cd apps/nest/auth-service && npx prisma generate
cd apps/nest/trip-service && npx prisma generate

# TimescaleDB hypertable (location-service)
psql -h localhost -p 5433 -U ainrider -d ainrider_location
SELECT create_hypertable('driver_locations', 'recorded_at');
```

### Testing

```bash
# Run all tests (when implemented)
pnpm test

# Run specific service tests
cd apps/nest/auth-service && pnpm test

# E2E tests
pnpm test:e2e
```

### Build

```bash
# Build all services
pnpm build

# Build specific service
cd apps/elysia/api-gateway && bun build ./src/index.ts --outdir ./dist
cd apps/nest/auth-service && pnpm run build
```

---

## Summary

| Component | Count | Purpose |
|-----------|-------|---------|
| Services | 8 | Business logic & real-time |
| Databases | 5 | Per-service isolation |
| PgBouncer instances | 5 | Connection pooling |
| Redis nodes | 6 | Cluster with replicas |
| NATS subjects | 20+ | Event-driven communication |
| API routes | 25+ | REST endpoints |
| WebSocket channels | 4 | Real-time subscriptions |

**Key Architectural Decisions:**

1. **Elysia for high-throughput** - Location updates, matching, WebSocket fanout
2. **NestJS for business logic** - Auth, trips, payments, admin
3. **NATS JetStream** - Persistent async messaging with replay
4. **Redis Cluster** - Sharded fast state for H3 geospatial
5. **TimescaleDB** - Time-series GPS history
6. **H3 geospatial** - O(1) proximity queries via hexagonal indexing
7. **Cookie-based auth** - HttpOnly, secure, automatic refresh
8. **Multi-Prisma admin** - Cross-database queries for admin panel
