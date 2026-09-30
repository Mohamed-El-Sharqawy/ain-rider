# Match Service Code Review

**Workspace**: backend
**Domain**: match-service
**Date**: 2026-04-07
**Files Reviewed**: 12 files

## Summary

The Match service handles driver-rider matching using H3 geospatial indexing and Redis for real-time driver availability. It consumes `trip_requested` events and runs match loops to find and assign nearby drivers. The architecture is sophisticated with proper timeout handling, driver exclusion on rejection, and detailed trip flow logging. However, there are critical issues: no authentication on endpoints, race conditions in driver registration, potential infinite match loops, duplicate `/driver/respond` endpoints, and the match loop spawns background processes that could accumulate.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/index.ts` | Issues found | 2 high, 2 medium |
| `src/modules/match/index.ts` | Issues found | 1 high |
| `src/modules/match/service.ts` | Issues found | 3 high, 3 medium |
| `src/modules/match/model.ts` | Clean | 0 |
| `src/shared/nats.ts` | Clean | 0 |
| `src/shared/redis.ts` | Clean | 0 |
| `src/shared/metrics.ts` | Clean | 0 |
| `src/shared/trip-flow-logger.ts` | Issues found | 1 low |
| `src/shared/error-handler.ts` | Clean | 0 |
| `src/shared/trace.ts` | Clean | 0 |
| `src/modules/health/index.ts` | Clean | 0 |

---

### HIGH FINDINGS

### HIGH MAT-001: No Authentication on Match Endpoints

- **File**: `src/modules/match/index.ts`, `src/index.ts`
- **Category**: security
- **Impact**: Anyone can register/unregister drivers or respond to match requests

**Description**

All endpoints are unauthenticated:
```typescript
.post('/available', async ({ body }) => { ... })
.post('/unavailable', async ({ body }) => { ... })
.post('/respond', async ({ body }) => { ... })
.get('/nearby', async ({ query }) => { ... })
```

A malicious actor could:
1. Register fake drivers with arbitrary locations
2. Unregister legitimate drivers
3. Accept/reject match requests on behalf of any driver
4. Query available driver locations

**Recommendation**

Add authentication middleware:
```typescript
import { internalAuthGuard } from '@ain-rider/internal-auth';

export const match = new Elysia({ prefix: '/driver' })
  .use(internalAuthGuard)
  .post('/available', ...)
```

For `/respond`, validate that the authenticated driver matches the one being assigned.

---

### HIGH MAT-002: Duplicate `/driver/respond` Endpoint Definitions

- **File**: `src/index.ts:130-140` and `src/modules/match/index.ts:30-50`
- **Category**: bug
- **Impact**: Confusion, potential routing issues

**Description**

The `/driver/respond` endpoint is defined in two places:

In `src/index.ts`:
```typescript
.post('/driver/respond', async ({ body, set }) => {
  const { tripId, action, driverId } = body as { tripId: string; action: string; driverId: string };
  // ...
})
```

In `src/modules/match/index.ts`:
```typescript
.post('/respond', async ({ body, set }) => {
  const { tripId, action, driverId } = body;
  // ...
}, { body: t.Object({ ... }) })
```

The module version has proper validation, the index version doesn't. Elysia may route to either depending on plugin order.

**Recommendation**

Remove the duplicate from `src/index.ts` and use only the validated version from the match module.

---

### HIGH MAT-003: Race Condition in Driver Registration

- **File**: `src/modules/match/service.ts:30-60`
- **Category**: bug
- **Impact**: Driver could be in multiple H3 cells or miss being registered

**Description**

Driver registration involves multiple Redis operations without atomicity:
```typescript
static async registerAvailableDriver(body: DriverAvailableBody): Promise<...> {
  // Remove from old cell
  const existing = await cache.get<AvailableDriver>(`driver:${body.driverId}`);
  if (existing?.h3Index && existing.h3Index !== h3Index) {
    await cache.del(`h3:cell:${existing.h3Index}`);  // Operation 1
  }

  // Add to new cell
  await cache.set(`driver:${body.driverId}`, driverData);  // Operation 2
  const cellDrivers = await cache.get<AvailableDriver[]>(`h3:cell:${h3Index}`) ?? [];
  cellDrivers.push(driverData);
  await cache.set(`h3:cell:${h3Index}`, cellDrivers);  // Operation 3
}
```

Between these operations, another registration or match could read inconsistent state.

**Recommendation**

Use Redis transactions or Lua scripts:
```typescript
// Use Redis MULTI/EXEC or a Lua script for atomicity
const lua = `
  local existing = redis.call('GET', KEYS[1])
  local existingData = cjson.decode(existing or '{}')
  
  if existingData.h3Index then
    redis.call('LREM', 'h3:cell:' .. existingData.h3Index, 0, ARGV[1])
  end
  
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('RPUSH', 'h3:cell:' .. ARGV[3], ARGV[1])
  return 1
`;
```

---

### HIGH MAT-004: Match Loop Could Run Indefinitely

- **File**: `src/modules/match/service.ts:80-200`
- **Category**: bug
- **Impact**: Zombie match loops consuming resources

**Description**

The match loop has a deadline but several paths could bypass it:
```typescript
const searchDeadline = Date.now() + SEARCH_DEADLINE_S * 1000;

while (!matched && Date.now() < searchDeadline) {
  // ... if no candidates found
  if (!selectedDriver) {
    await new Promise(r => setTimeout(r, 5000));
    attempt++;
    continue;  // Loop continues
  }
  
  // ... if driver times out
  if (response === null) {
    attempt++;
    // Loop continues without checking deadline
  }
}
```

If the loop repeatedly finds no candidates or drivers timeout, it could exceed the deadline due to the `continue` statements not re-checking the deadline.

**Recommendation**

Add explicit deadline checks:
```typescript
if (!selectedDriver) {
  if (Date.now() >= searchDeadline) break;
  await new Promise(r => setTimeout(r, 5000));
  attempt++;
  continue;
}
```

---

### HIGH MAT-005: Background Match Loop Not Tracked for Cleanup

- **File**: `src/index.ts:70-85`
- **Category**: bug
- **Impact**: Orphaned match loops on service shutdown

**Description**

Match loops are spawned in the background:
```typescript
activeMatchLoops.add(payload.tripId);
MatchService.matchDriver(tripRequest)
  .catch(err => { ... })
  .finally(() => activeMatchLoops.delete(payload.tripId));
```

If the service crashes or is terminated, these background processes are lost without cleanup. The `activeMatchLoops` set only prevents duplicates within a single process.

**Recommendation**

Track promises for graceful shutdown:
```typescript
const activePromises = new Set<Promise<void>>();

// On shutdown
async function shutdown() {
  await Promise.allSettled([...activePromises]);
  // Then close connections
}
```

---

### MEDIUM FINDINGS

### MEDIUM MAT-006: Match Loop Spawns Without Backpressure

- **File**: `src/index.ts:70-85`
- **Category**: performance
- **Impact**: Too many concurrent match loops could overwhelm resources

**Description**

Every `trip_requested` event spawns a new match loop without limiting concurrency:
```typescript
MatchService.matchDriver(tripRequest)
  .catch(err => { ... })
  .finally(() => activeMatchLoops.delete(payload.tripId));
```

During high demand, hundreds of match loops could run simultaneously.

**Recommendation**

Implement a semaphore or queue:
```typescript
import { Semaphore } from 'async-mutex';

const matchConcurrency = new Semaphore(50);  // Max 50 concurrent

await matchConcurrency.runExclusive(async () => {
  await MatchService.matchDriver(tripRequest);
});
```

---

### MEDIUM MAT-007: Driver Exclusion Set Not Cleaned on Match Success

- **File**: `src/modules/match/service.ts:180-190`
- **Category**: bug
- **Impact**: Memory leak in Redis

**Description**

On successful match:
```typescript
await redisCluster.del(`match:response:${tripId}`);
await redisCluster.del(`match:excluded:${tripId}`);
```

The exclusion set is deleted, but if the match loop crashes before this cleanup, the keys remain.

**Recommendation**

Set TTL on all match-related keys when creating them:
```typescript
await redisCluster.sadd(`match:excluded:${tripId}`, driverId);
await redisCluster.expire(`match:excluded:${tripId}`, 600);  // Already done
```

Ensure all keys have TTL set at creation time.

---

### MEDIUM MAT-008: No Validation of DriverId in Respond Endpoint

- **File**: `src/modules/match/index.ts:30-50`
- **Category**: security
- **Impact**: Any driver can accept/reject for another driver

**Description**

```typescript
.post('/respond', async ({ body, set }) => {
  const { tripId, action, driverId } = body;
  // No validation that the request comes from this driver
  await redisCluster.set(`match:response:${tripId}`, value, 'EX', 60);
})
```

The endpoint accepts any `driverId` in the body without verifying the caller is that driver.

**Recommendation**

Validate driver identity from auth token:
```typescript
.post('/respond', async ({ body, set, headers }) => {
  const authenticatedDriverId = validateToken(headers.authorization);
  const { tripId, action, driverId } = body;
  
  if (driverId !== authenticatedDriverId) {
    set.status = 403;
    return { error: 'Cannot respond for another driver' };
  }
  // ...
})
```

---

### MEDIUM MAT-009: Trip Flow Logger Writes to File System

- **File**: `src/shared/trip-flow-logger.ts`
- **Category**: architecture
- **Impact**: Not suitable for containerized deployments

**Description**

```typescript
const LOG_FILE = join(LOG_DIR, 'trip-flow.log');
// ...
appendFileSync(LOG_FILE, line);
```

Writing to local filesystem doesn't work well in containerized environments with multiple replicas.

**Recommendation**

Use structured logging to stdout and let the orchestration platform handle log aggregation:
```typescript
console.log(JSON.stringify({
  level: 'info',
  type: 'trip_flow',
  step: entry.step,
  tripId: entry.tripId,
  driverId: entry.driverId,
  detail: entry.detail,
  data: entry.data,
  timestamp: new Date().toISOString(),
}));
```

---

### LOW FINDINGS

### LOW MAT-010: Hardcoded Search Parameters

- **File**: `src/modules/match/service.ts:10-20`
- **Category**: code-quality
- **Impact**: Cannot tune without code changes

**Description**

```typescript
const H3_RESOLUTION = 9;
const SEARCH_RINGS = [1, 2, 3, 4, 5];
const MAX_SEARCH_RADIUS_M = 5000;
const DRIVER_RESPONSE_TIMEOUT_S = 15;
const SEARCH_DEADLINE_S = 120;
const DRIVER_RESPONSE_POLL_MS = 500;
```

These are hardcoded and cannot be adjusted per environment.

**Recommendation**

Make configurable via environment:
```typescript
const SEARCH_DEADLINE_S = parseInt(process.env.MATCH_DEADLINE_S || '120');
const DRIVER_RESPONSE_TIMEOUT_S = parseInt(process.env.DRIVER_TIMEOUT_S || '15');
```

---

### LOW MAT-011: No Metrics for Active Match Loops

- **File**: `src/shared/metrics.ts`
- **Category**: observability
- **Impact**: Cannot monitor match loop backlog

**Description**

There's no gauge for tracking active match loops:
```typescript
export const availableDriversGauge = new Gauge({ ... });
// Missing: activeMatchLoopsGauge
```

**Recommendation**

Add a gauge for active match loops:
```typescript
export const activeMatchLoopsGauge = new Gauge({
  name: 'match_service_active_loops',
  help: 'Number of active match loops currently running',
});

// Update in index.ts
activeMatchLoopsGauge.set(activeMatchLoops.size);
```

---

### LOW MAT-012: Manual Match Endpoint Has No Validation

- **File**: `src/modules/match/index.ts:55-75`
- **Category**: code-quality
- **Impact**: Invalid coordinates could be accepted

**Description**

```typescript
.post('/manual', async ({ body }) => {
  return MatchService.manualMatch(body);
}, { body: MatchModel.manualMatchBody })
```

The `manualMatchBody` model exists but the service method may not validate coordinate bounds.

**Recommendation**

Ensure the model validates coordinates:
```typescript
manualMatchBody: t.Object({
  tripId: t.String(),
  riderId: t.String(),
  pickupLatitude: t.Number({ minimum: -90, maximum: 90 }),
  pickupLongitude: t.Number({ minimum: -180, maximum: 180 }),
  // ...
}),
```

---

### LOW MAT-013: Unregister Doesn't Clean H3 Cell

- **File**: `src/modules/match/service.ts:65-75`
- **Category**: bug
- **Impact**: Stale driver entries in H3 cells

**Description**

```typescript
static async unregisterDriver(driverId: string): Promise<void> {
  await cache.del(`driver:${driverId}`);
  // Doesn't remove from h3:cell:{h3Index}
}
```

The driver is removed from the driver key but not from the H3 cell driver list. Queries for that cell would still return the driver until the cell is refreshed.

**Recommendation**

Fetch the driver's H3 index before deleting and clean up:
```typescript
static async unregisterDriver(driverId: string): Promise<void> {
  const existing = await cache.get<AvailableDriver>(`driver:${driverId}`);
  if (existing?.h3Index) {
    const cellDrivers = await cache.get<AvailableDriver[]>(`h3:cell:${existing.h3Index}`) ?? [];
    const filtered = cellDrivers.filter(d => d.driverId !== driverId);
    await cache.set(`h3:cell:${existing.h3Index}`, filtered);
  }
  await cache.del(`driver:${driverId}`);
}
```