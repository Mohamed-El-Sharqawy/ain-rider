# Shared Packages Code Review

**Workspace**: backend
**Domain**: packages
**Date**: 2026-04-07
**Packages Reviewed**: 6 packages

## Summary

The shared packages provide common functionality across all microservices including error handling, NATS client utilities, Redis caching, internal API communication, and shared TypeScript types. The packages are well-structured with proper TypeScript types, error handling, and metrics. However, there are issues with hardcoded Redis NAT mappings, inconsistent Redis client handling between packages, missing validation in type definitions, and the internal-api package lacks authentication support.

## Packages Covered

| Package | Status | Findings |
|---------|--------|----------|
| `@ain-rider/error-handling` | Clean | 0 |
| `@ain-rider/nats-client` | Issues found | 2 medium, 2 low |
| `@ain-rider/shared-types` | Issues found | 1 medium, 1 low |
| `@ain-rider/redis-client` | Issues found | 1 high, 1 medium |
| `@ain-rider/internal-api` | Issues found | 2 medium |
| `@ain-rider/metrics` | Not reviewed separately (simple wrapper) |

---

## @ain-rider/error-handling

### Summary

Well-designed error handling package with proper error class hierarchy, Pino logging with sensitive data redaction, and middleware utilities. No significant issues found.

### Files Reviewed

- `src/index.ts` - Package exports
- `src/errors/app-error.ts` - Base error class
- `src/errors/index.ts` - Error class exports
- `src/middleware/error-mapper.ts` - Error normalization
- `src/logger/pino-logger.ts` - Pino logger wrapper

### Strengths

- Clean error class hierarchy with proper HTTP status mapping
- Automatic sensitive data redaction in logs (password, token, secret, etc.)
- Unified error response format with trace ID
- NestJS HttpException mapping support

---

## @ain-rider/nats-client

### Summary

Comprehensive NATS JetStream client with publisher, consumer, idempotency, DLQ, and request-reply support. The consumer base class is well-designed with proper ack/nak handling.

### Files Reviewed

- `src/index.ts` - Package exports
- `src/publisher.ts` - Legacy publisher
- `src/consumer.ts` - Legacy consumer
- `src/jetstream/publisher.ts` - JetStream publisher
- `src/jetstream/consumer.ts` - JetStream consumer base class
- `src/idempotency/idempotency.service.ts` - Idempotency service

### MEDIUM FINDINGS

### MEDIUM PKG-NATS-001: Legacy Consumer Has No Idempotency

- **File**: `src/consumer.ts`
- **Category**: bug
- **Impact**: Duplicate message processing with legacy consumer

**Description**

The legacy `NatsConsumer` class doesn't support idempotency:
```typescript
export class NatsConsumer {
  async subscribe<T = any>(subject: string, handler: MessageHandler<T>, options?: Partial<ConsumerOptions>): Promise<void> {
    // No idempotency support
    for await (const msg of messages) {
      try {
        const data = JSON.parse(new TextDecoder().decode(msg.data)) as T;
        await handler(data, msg);
        msg.ack();
      } catch (error) {
        msg.nak();
      }
    }
  }
}
```

The new `JetStreamConsumer` has idempotency, but services using the legacy consumer won't have duplicate protection.

**Recommendation**

Deprecate the legacy consumer and migrate all services to `JetStreamConsumer`.

---

### MEDIUM PKG-NATS-002: Consumer Auto-Creates Streams with Single Subject

- **File**: `src/jetstream/consumer.ts:95-110`
- **Category**: bug
- **Impact**: Stream created with only one subject, blocking other events

**Description**

```typescript
private async ensureStream(): Promise<void> {
  // ...
  await jsm.streams.add({
    name: this.config.streamName,
    subjects: [this.config.filterSubject],  // Only one subject!
    // ...
  });
}
```

If the stream doesn't exist, it's created with only the consumer's filter subject. Other consumers for the same stream would fail to create their subjects.

**Recommendation**

Don't auto-create streams; require explicit stream setup:
```typescript
private async ensureStream(): Promise<void> {
  const jsm = await this.nc.jetstreamManager();
  try {
    await jsm.streams.info(this.config.streamName);
  } catch {
    throw new Error(
      `Stream ${this.config.streamName} does not exist. ` +
      `Please create it with all required subjects before starting consumers.`
    );
  }
}
```

---

### LOW FINDINGS

### LOW PKG-NATS-003: Idempotency Service Accepts `any` for Redis Client

- **File**: `src/idempotency/idempotency.service.ts:30-35`
- **Category**: code-quality
- **Impact**: Type safety loss

**Description**

```typescript
constructor(
  redisClient?: RedisClient | any,
  config?: IdempotencyConfig
) {
  this.redis = redisClient || createClient({ ... });
}
```

The `any` type is used to support both node-redis and ioredis clients.

**Recommendation**

Create a minimal interface for the required methods:
```typescript
interface RedisClientLike {
  exists(key: string): Promise<number | boolean>;
  setEx?(key: string, ttl: number, value: string): Promise<void>;
  setex?(key: string, ttl: number, value: string): Promise<void>;
  set(key: string, value: string, ...args: string[]): Promise<void>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  quit?(): Promise<void>;
  status?: string;
  isOpen?: boolean;
}
```

---

### LOW PKG-NATS-004: No Metrics for Idempotency Hits/Misses

- **File**: `src/idempotency/idempotency.service.ts`
- **Category**: observability
- **Impact**: Cannot monitor idempotency effectiveness

**Description**

The idempotency service doesn't emit metrics for duplicate detection.

**Recommendation**

Add metrics:
```typescript
async isProcessed(consumerName: string, eventId: string): Promise<boolean> {
  const key = this.buildKey(consumerName, eventId);
  const exists = await this.redis.exists(key);
  
  if (exists) {
    idempotencyHits.inc({ consumer: consumerName });
  }
  
  return exists === 1 || exists === true;
}
```

---

## @ain-rider/shared-types

### Summary

TypeScript type definitions for all domain entities and NATS event payloads. Well-organized by domain (user, trip, payment, etc.) with proper enums.

### Files Reviewed

- `src/index.ts` - Package exports
- `src/events.types.ts` - NATS subjects and event payloads
- `src/trip.types.ts` - Trip domain types
- `src/user.types.ts` - User domain types
- `src/payment.types.ts` - Payment domain types
- `src/wallet.types.ts` - Wallet domain types
- `src/location.types.ts` - Location domain types

### MEDIUM FINDINGS

### MEDIUM PKG-TYPES-001: Event Payloads Have Optional Fields Without Defaults

- **File**: `src/events.types.ts:60-90`
- **Category**: bug
- **Impact**: Undefined values could cause runtime errors

**Description**

Many event payload fields are optional without clear semantics:
```typescript
export interface TripMatchedEvent {
  subject: typeof NATS_SUBJECTS.TRIP_MATCHED;
  data: {
    tripId: string;
    driverId?: string | null;  // Optional AND nullable
    estimatedArrival?: number;
    status?: string;
    actualFare?: number | null;
    // ...
  };
}
```

The `driverId` being both optional and nullable is confusing. Is it missing, null, or undefined?

**Recommendation**

Use discriminated unions for different states:
```typescript
export interface TripMatchedEvent {
  subject: typeof NATS_SUBJECTS.TRIP_MATCHED;
  data: {
    tripId: string;
    status: 'MATCHED';
    driverId: string;  // Required when matched
    estimatedArrival: number;
    // ...
  };
}

export interface TripPendingMatchEvent {
  subject: typeof NATS_SUBJECTS.TRIP_REQUESTED;
  data: {
    tripId: string;
    status: 'REQUESTED';
    driverId?: never;  // Not present when pending
    // ...
  };
}
```

---

### LOW PKG-TYPES-002: No Runtime Validation for Types

- **File**: All type files
- **Category**: architecture
- **Impact**: Types are compile-time only, no runtime validation

**Description**

TypeScript types provide no runtime validation. Events received over NATS could have invalid data.

**Recommendation**

Consider using Zod or similar for runtime validation:
```typescript
import { z } from 'zod';

export const TripMatchedPayloadSchema = z.object({
  tripId: z.string().uuid(),
  driverId: z.string().uuid(),
  estimatedArrival: z.number().positive(),
  // ...
});

export type TripMatchedPayload = z.infer<typeof TripMatchedPayloadSchema>;
```

---

## @ain-rider/redis-client

### Summary

Redis cluster client with caching utilities. Provides both cluster connection and a cache wrapper class.

### Files Reviewed

- `src/index.ts` - Package exports
- `src/cluster.ts` - Redis cluster creation
- `src/cache.ts` - Cache wrapper class

### HIGH FINDINGS

### HIGH PKG-REDIS-001: Hardcoded NAT Mapping for Local Development

- **File**: `src/cluster.ts:20-45`
- **Category**: security
- **Impact**: Production deployments would route to wrong hosts

**Description**

```typescript
natMap: {
  // 3 masters - local development
  "ain-rider-redis-1:6379": { host: "127.0.0.1", port: 6379 },
  "ain-rider-redis-1:0":    { host: "127.0.0.1", port: 6379 },
  "ain-rider-redis-2:6379": { host: "127.0.0.1", port: 6380 },
  // ... more hardcoded mappings
}
```

The NAT (Network Address Translation) map is hardcoded for local development. In production with Docker/Kubernetes, this would cause connections to fail or route incorrectly.

**Recommendation**

Make NAT mapping configurable:
```typescript
export interface RedisClusterConfig {
  nodes: string[];
  password?: string;
  keyPrefix?: string;
  natMap?: Record<string, { host: string; port: number }>;
}

export function createRedisCluster(config: RedisClusterConfig): Cluster {
  const options: ClusterOptions = {
    natMap: config.natMap ?? {},  // Use provided or empty
    // ...
  };
}
```

Or auto-detect from environment:
```typescript
natMap: process.env.REDIS_NAT_MAP 
  ? JSON.parse(process.env.REDIS_NAT_MAP)
  : {}
```

---

### MEDIUM PKG-REDIS-002: Cache Get Swallows Errors

- **File**: `src/cache.ts:10-20`
- **Category**: bug
- **Impact**: Cache failures are silent

**Description**

```typescript
async get<T = any>(key: string): Promise<T | null> {
  try {
    const value = await this.cluster.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`[Redis Cache] Get error for key ${key}:`, error);
    return null;  // Returns null on error
  }
}
```

Cache failures return `null`, indistinguishable from a cache miss. This could cause unnecessary database load during Redis outages.

**Recommendation**

Consider throwing or returning a result type:
```typescript
async get<T = any>(key: string): Promise<{ data: T; cached: boolean } | null> {
  try {
    const value = await this.cluster.get(key);
    return value ? { data: JSON.parse(value), cached: true } : null;
  } catch (error) {
    // Log but don't silently fail - caller should know
    throw new CacheError(`Failed to get key ${key}`, error);
  }
}
```

---

## @ain-rider/internal-api

### Summary

Internal API client for service-to-service HTTP communication. Provides a simple fetch wrapper with metrics hooks.

### Files Reviewed

- `src/index.ts` - Package exports
- `src/fetch-internal.ts` - Internal fetch implementation
- `src/types.ts` - Type definitions

### MEDIUM FINDINGS

### MEDIUM PKG-API-001: No Authentication Support

- **File**: `src/fetch-internal.ts`
- **Category**: security
- **Impact**: No internal auth headers added to requests

**Description**

```typescript
export async function fetchInternal(
  url: string,
  method: string = 'GET',
  body?: unknown,
  options: FetchInternalOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  // No automatic internal auth header
}
```

The package doesn't automatically add internal authentication headers (like `x-internal-secret` or JWT).

**Recommendation**

Add automatic internal auth:
```typescript
export interface FetchInternalConfig {
  serviceName: string;
  internalSecret?: string;  // Add this
  metrics?: MetricsHooks;
  logger?: LoggerHooks;
}

export async function fetchInternal(...): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  
  // Add internal auth if configured
  if (globalConfig?.internalSecret) {
    headers['x-internal-secret'] = globalConfig.internalSecret;
  }
  // ...
}
```

---

### MEDIUM PKG-API-002: No Retry Logic

- **File**: `src/fetch-internal.ts`
- **Category**: reliability
- **Impact**: Transient failures cause immediate errors

**Description**

```typescript
const res = await fetch(url, {
  method,
  headers,
  body: serializedBody,
});
// No retry on failure
```

No retry logic for transient failures.

**Recommendation**

Add retry with exponential backoff:
```typescript
export interface FetchInternalConfig {
  // ...
  maxRetries?: number;
  retryDelay?: number;
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res;  // Don't retry client errors
      
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    
    if (attempt < maxRetries) {
      await sleep(100 * Math.pow(2, attempt));
    }
  }
  
  throw lastError;
}
```

---

## Cross-Package Issues

### PKG-CROSS-001: Inconsistent Redis Client Usage

- **Files**: `nats-client/src/idempotency`, `redis-client/src/cluster.ts`
- **Category**: architecture
- **Impact**: Confusion between node-redis and ioredis

**Description**

- `@ain-rider/redis-client` uses `ioredis`
- `@ain-rider/nats-client` idempotency service uses `node-redis` by default but accepts `ioredis`

Services need to manage two different Redis client libraries.

**Recommendation**

Standardize on one Redis client library across all packages. `ioredis` is generally more feature-complete for cluster support.

---

### PKG-CROSS-002: No Shared Configuration Package

- **Category**: architecture
- **Impact**: Each service implements its own config loading

**Description**

There's no shared package for:
- Environment variable loading and validation
- Configuration schema definitions
- Default values

**Recommendation**

Create `@ain-rider/config` package:
```typescript
// @ain-rider/config
export const config = {
  nats: {
    servers: process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'],
  },
  redis: {
    nodes: process.env.REDIS_NODES?.split(',') || ['localhost:6379'],
  },
  jwt: {
    secret: process.env.JWT_SECRET,  // Required
  },
  internal: {
    secret: process.env.INTERNAL_SERVICE_SECRET,  // Required
  },
};

export function validateConfig(): void {
  if (!config.jwt.secret) throw new Error('JWT_SECRET is required');
  if (!config.internal.secret) throw new Error('INTERNAL_SERVICE_SECRET is required');
}
```