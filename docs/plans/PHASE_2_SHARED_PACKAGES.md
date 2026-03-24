# Phase 2: Shared Packages Setup

**Estimated Time**: 45 minutes  
**Prerequisites**: Phase 1 completed

---

## Objectives

Build three shared packages that provide type safety and client abstractions across all services:

1. `@ain-rider/shared-types` - Domain models and event schemas
2. `@ain-rider/nats-client` - Typed NATS JetStream wrapper
3. `@ain-rider/redis-client` - Redis Cluster client wrapper

---

## Package 1: @ain-rider/shared-types

### Step 1.1: Create Package Configuration

Create `packages/shared-types/package.json`:

```json
{
  "name": "@ain-rider/shared-types",
  "version": "1.0.0",
  "description": "Shared TypeScript types for 911 Ain Rider",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "rimraf": "^6.0.1"
  }
}
```

Create `packages/shared-types/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.2: Define Domain Types

Create `packages/shared-types/src/user.types.ts`:

```typescript
export enum UserRole {
  RIDER = 'RIDER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver extends User {
  role: UserRole.DRIVER;
  vehicleId?: string;
  licenseNumber: string;
  rating: number;
  totalTrips: number;
  isOnline: boolean;
  currentLocation?: Location;
}

export interface Rider extends User {
  role: UserRole.RIDER;
  rating: number;
  totalTrips: number;
}
```

Create `packages/shared-types/src/location.types.ts`:

```typescript
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends Coordinates {
  timestamp: Date;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationUpdate {
  driverId: string;
  location: Location;
  h3Index: string; // H3 geospatial index
}

export interface GeoFence {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
}
```

Create `packages/shared-types/src/trip.types.ts`:

```typescript
import { Coordinates } from './location.types';

export enum TripStatus {
  REQUESTED = 'REQUESTED',
  MATCHED = 'MATCHED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export interface Trip {
  id: string;
  riderId: string;
  driverId?: string;
  status: TripStatus;
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  actualFare?: number;
  paymentMethod: PaymentMethod;
  distance?: number; // meters
  duration?: number; // seconds
  requestedAt: Date;
  matchedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface TripRequest {
  riderId: string;
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  pickupAddress: string;
  dropoffAddress: string;
  paymentMethod: PaymentMethod;
}
```

Create `packages/shared-types/src/payment.types.ts`:

```typescript
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  tripId: string;
  riderId: string;
  driverId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Fare {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgePricing: number;
  total: number;
  currency: string;
}
```

Create `packages/shared-types/src/events.types.ts`:

```typescript
import { Location, LocationUpdate } from './location.types';
import { Trip, TripStatus } from './trip.types';

// NATS Event Subjects
export const NATS_SUBJECTS = {
  LOCATION_UPDATE: 'location.update',
  TRIP_REQUESTED: 'trip.requested',
  TRIP_MATCHED: 'trip.matched',
  TRIP_STARTED: 'trip.started',
  TRIP_COMPLETED: 'trip.completed',
  TRIP_CANCELLED: 'trip.cancelled',
  DRIVER_STATUS_CHANGED: 'driver.status.changed',
  PAYMENT_PROCESSED: 'payment.processed',
} as const;

// Event Payloads
export interface LocationUpdateEvent {
  subject: typeof NATS_SUBJECTS.LOCATION_UPDATE;
  data: LocationUpdate;
}

export interface TripRequestedEvent {
  subject: typeof NATS_SUBJECTS.TRIP_REQUESTED;
  data: {
    tripId: string;
    riderId: string;
    pickupLocation: Location;
    dropoffLocation: Location;
  };
}

export interface TripMatchedEvent {
  subject: typeof NATS_SUBJECTS.TRIP_MATCHED;
  data: {
    tripId: string;
    driverId: string;
    estimatedArrival: number; // seconds
  };
}

export interface TripStatusChangedEvent {
  subject: typeof NATS_SUBJECTS.TRIP_STARTED | typeof NATS_SUBJECTS.TRIP_COMPLETED | typeof NATS_SUBJECTS.TRIP_CANCELLED;
  data: {
    tripId: string;
    status: TripStatus;
    timestamp: Date;
  };
}

export interface DriverStatusChangedEvent {
  subject: typeof NATS_SUBJECTS.DRIVER_STATUS_CHANGED;
  data: {
    driverId: string;
    isOnline: boolean;
    location?: Location;
  };
}

export interface PaymentProcessedEvent {
  subject: typeof NATS_SUBJECTS.PAYMENT_PROCESSED;
  data: {
    tripId: string;
    paymentId: string;
    amount: number;
    status: string;
  };
}

export type NatsEvent =
  | LocationUpdateEvent
  | TripRequestedEvent
  | TripMatchedEvent
  | TripStatusChangedEvent
  | DriverStatusChangedEvent
  | PaymentProcessedEvent;
```

Create `packages/shared-types/src/index.ts`:

```typescript
export * from './user.types';
export * from './location.types';
export * from './trip.types';
export * from './payment.types';
export * from './events.types';
export * from './vehicle.types';
export * from './wallet.types';
export * from './promo.types';
export * from './notification.types';
export * from './sos.types';
export * from './complaint.types';
export * from './report.types';
export * from './settings.types';
```

**Note**: Additional type files for admin dashboard features (vehicle, wallet, promo, notification, sos, complaint, report, settings) are included in the shared-types package. These types support the complete admin panel functionality including vehicle management, wallet/withdrawals, promotional codes, push notifications, SOS alerts, complaint management, reporting, and system settings.

### Step 1.3: Build Package

```bash
cd packages/shared-types
pnpm install
pnpm build
```

---

## Package 2: @ain-rider/nats-client

### Step 2.1: Create Package Configuration

Create `packages/nats-client/package.json`:

```json
{
  "name": "@ain-rider/nats-client",
  "version": "1.0.0",
  "description": "Typed NATS JetStream client for 911 Ain Rider",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "nats": "^2.29.3",
    "@ain-rider/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "typescript": "^5.7.3",
    "rimraf": "^6.0.1"
  }
}
```

Create `packages/nats-client/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2.2: Implement NATS Client

Create `packages/nats-client/src/connection.ts`:

```typescript
import { connect, NatsConnection, ConnectionOptions } from 'nats';

export interface NatsConfig {
  url: string;
  name?: string;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
}

export async function createNatsConnection(config: NatsConfig): Promise<NatsConnection> {
  const options: ConnectionOptions = {
    servers: config.url,
    name: config.name || 'ain-rider-service',
    maxReconnectAttempts: config.maxReconnectAttempts || -1, // infinite
    reconnectTimeWait: config.reconnectTimeWait || 2000, // 2 seconds
  };

  try {
    const nc = await connect(options);
    console.log(`[NATS] Connected to ${nc.getServer()}`);

    // Handle connection events
    (async () => {
      for await (const status of nc.status()) {
        console.log(`[NATS] Status: ${status.type}: ${status.data}`);
      }
    })().catch((err) => {
      console.error('[NATS] Status error:', err);
    });

    return nc;
  } catch (error) {
    console.error('[NATS] Connection failed:', error);
    throw error;
  }
}
```

Create `packages/nats-client/src/publisher.ts`:

```typescript
import { NatsConnection, JetStreamClient, JetStreamPublishOptions } from 'nats';
import { NatsEvent } from '@ain-rider/shared-types';

export class NatsPublisher {
  private js: JetStreamClient;

  constructor(private nc: NatsConnection) {
    this.js = nc.jetstream();
  }

  async publish<T extends NatsEvent>(
    event: T,
    options?: Partial<JetStreamPublishOptions>
  ): Promise<void> {
    try {
      const payload = JSON.stringify(event.data);
      await this.js.publish(event.subject, new TextEncoder().encode(payload), options);
      console.log(`[NATS Publisher] Published to ${event.subject}`);
    } catch (error) {
      console.error(`[NATS Publisher] Failed to publish to ${event.subject}:`, error);
      throw error;
    }
  }

  async publishBatch(events: NatsEvent[]): Promise<void> {
    const promises = events.map((event) => this.publish(event));
    await Promise.all(promises);
  }
}

export function createPublisher(nc: NatsConnection): NatsPublisher {
  return new NatsPublisher(nc);
}
```

Create `packages/nats-client/src/consumer.ts`:

```typescript
import { NatsConnection, JetStreamClient, JsMsg, ConsumerConfig } from 'nats';

export interface ConsumerOptions {
  stream: string;
  consumer: string;
  filterSubject?: string;
  deliverPolicy?: 'all' | 'last' | 'new';
  ackWait?: number; // milliseconds
  maxDeliver?: number;
}

export type MessageHandler<T = any> = (data: T, msg: JsMsg) => Promise<void>;

export class NatsConsumer {
  private js: JetStreamClient;

  constructor(private nc: NatsConnection) {
    this.js = nc.jetstream();
  }

  async subscribe<T = any>(
    subject: string,
    handler: MessageHandler<T>,
    options?: Partial<ConsumerOptions>
  ): Promise<void> {
    try {
      const consumer = await this.js.consumers.get(
        options?.stream || 'AIN_RIDER',
        options?.consumer || `${subject}-consumer`
      );

      const messages = await consumer.consume();

      console.log(`[NATS Consumer] Subscribed to ${subject}`);

      for await (const msg of messages) {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.data)) as T;
          await handler(data, msg);
          msg.ack();
        } catch (error) {
          console.error(`[NATS Consumer] Error processing message:`, error);
          msg.nak();
        }
      }
    } catch (error) {
      console.error(`[NATS Consumer] Subscription failed for ${subject}:`, error);
      throw error;
    }
  }

  async createStream(streamName: string, subjects: string[]): Promise<void> {
    try {
      const jsm = await this.nc.jetstreamManager();
      await jsm.streams.add({
        name: streamName,
        subjects,
        retention: 'limits',
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
        storage: 'file',
      });
      console.log(`[NATS] Stream ${streamName} created`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`[NATS] Stream ${streamName} already exists`);
      } else {
        throw error;
      }
    }
  }
}

export function createConsumer(nc: NatsConnection): NatsConsumer {
  return new NatsConsumer(nc);
}
```

Create `packages/nats-client/src/index.ts`:

```typescript
export * from './connection';
export * from './publisher';
export * from './consumer';
```

### Step 2.3: Build Package

```bash
cd packages/nats-client
pnpm install
pnpm build
```

---

## Package 3: @ain-rider/redis-client

### Step 3.1: Create Package Configuration

Create `packages/redis-client/package.json`:

```json
{
  "name": "@ain-rider/redis-client",
  "version": "1.0.0",
  "description": "Redis Cluster client for 911 Ain Rider",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "ioredis": "^5.10.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "typescript": "^5.7.3",
    "rimraf": "^6.0.1"
  }
}
```

Create `packages/redis-client/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 3.2: Implement Redis Cluster Client

Create `packages/redis-client/src/cluster.ts`:

```typescript
import Redis, { Cluster, ClusterOptions } from 'ioredis';

export interface RedisClusterConfig {
  nodes: string[]; // ["host:port", "host:port", ...]
  password?: string;
  keyPrefix?: string;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
}

export function createRedisCluster(config: RedisClusterConfig): Cluster {
  const nodes = config.nodes.map((node) => {
    const [host, port] = node.split(':');
    return { host, port: parseInt(port, 10) };
  });

  const options: ClusterOptions = {
    redisOptions: {
      password: config.password,
      keyPrefix: config.keyPrefix,
      enableReadyCheck: config.enableReadyCheck ?? true,
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
    },
    clusterRetryStrategy: (times: number) => {
      const delay = Math.min(100 + times * 100, 2000);
      console.log(`[Redis Cluster] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  };

  const cluster = new Redis.Cluster(nodes, options);

  cluster.on('connect', () => {
    console.log('[Redis Cluster] Connected');
  });

  cluster.on('ready', () => {
    console.log('[Redis Cluster] Ready');
  });

  cluster.on('error', (err) => {
    console.error('[Redis Cluster] Error:', err);
  });

  cluster.on('close', () => {
    console.log('[Redis Cluster] Connection closed');
  });

  cluster.on('reconnecting', () => {
    console.log('[Redis Cluster] Reconnecting...');
  });

  cluster.on('end', () => {
    console.log('[Redis Cluster] Connection ended');
  });

  return cluster;
}
```

Create `packages/redis-client/src/cache.ts`:

```typescript
import { Cluster } from 'ioredis';

export class RedisCache {
  constructor(private cluster: Cluster) {}

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.cluster.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Redis Cache] Get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.cluster.setex(key, ttlSeconds, serialized);
      } else {
        await this.cluster.set(key, serialized);
      }
    } catch (error) {
      console.error(`[Redis Cache] Set error for key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cluster.del(key);
    } catch (error) {
      console.error(`[Redis Cache] Delete error for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.cluster.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis Cache] Exists error for key ${key}:`, error);
      return false;
    }
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.cluster.mget(...keys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error(`[Redis Cache] Mget error:`, error);
      return keys.map(() => null);
    }
  }

  async mset(entries: Record<string, any>, ttlSeconds?: number): Promise<void> {
    try {
      const pipeline = this.cluster.pipeline();
      
      for (const [key, value] of Object.entries(entries)) {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error(`[Redis Cache] Mset error:`, error);
      throw error;
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.cluster.incrby(key, by);
    } catch (error) {
      console.error(`[Redis Cache] Increment error for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.cluster.expire(key, ttlSeconds);
    } catch (error) {
      console.error(`[Redis Cache] Expire error for key ${key}:`, error);
      throw error;
    }
  }
}

export function createCache(cluster: Cluster): RedisCache {
  return new RedisCache(cluster);
}
```

Create `packages/redis-client/src/index.ts`:

```typescript
export * from './cluster';
export * from './cache';
export { Cluster } from 'ioredis';
```

### Step 3.3: Build Package

```bash
cd packages/redis-client
pnpm install
pnpm build
```

---

## Verification Steps

Run from `backend/` root:

```bash
# Install all workspace dependencies
pnpm install

# Build all shared packages
pnpm --filter './packages/**' build

# Verify builds
ls -la packages/shared-types/dist
ls -la packages/nats-client/dist
ls -la packages/redis-client/dist

# Check package linking
pnpm list --depth 0
```

---

## Expected Output

```
packages/
├── shared-types/
│   ├── dist/
│   │   ├── index.js
│   │   ├── index.d.ts
│   │   ├── user.types.js
│   │   ├── location.types.js
│   │   ├── trip.types.js
│   │   ├── payment.types.js
│   │   └── events.types.js
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── nats-client/
│   ├── dist/
│   │   ├── index.js
│   │   ├── connection.js
│   │   ├── publisher.js
│   │   └── consumer.js
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
└── redis-client/
    ├── dist/
    │   ├── index.js
    │   ├── cluster.js
    │   └── cache.js
    ├── src/
    ├── package.json
    └── tsconfig.json
```

---

## Common Issues

### Issue: TypeScript path mapping not working
**Solution**: Ensure `tsconfig.base.json` paths are correct and run `pnpm install` at root.

### Issue: Workspace dependencies not resolving
**Solution**: 
```bash
pnpm install --force
pnpm --filter './packages/**' build
```

### Issue: Build errors in dependent packages
**Solution**: Build packages in order:
```bash
cd packages/shared-types && pnpm build
cd ../nats-client && pnpm build
cd ../redis-client && pnpm build
```

---

## Next Steps

✅ Phase 2 Complete!

Proceed to **Phase 3**: `PHASE_3_ELYSIA_SERVICES.md`
