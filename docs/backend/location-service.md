# Location Service Code Review

**Workspace**: backend
**Domain**: location-service
**Date**: 2026-04-07
**Files Reviewed**: 12 files

## Summary

The Location service handles driver GPS updates using Redis for real-time position caching with H3 geospatial indexing, TimescaleDB for historical data, and NATS for event publishing. The architecture is clean and efficient for high-frequency location updates. However, there are issues with hardcoded database URLs, missing authentication on endpoints, potential race conditions in Redis updates, and the nearby drivers query only checks the exact H3 cell rather than neighboring cells for proper radius search.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/index.ts` | Clean | 0 |
| `src/modules/location/index.ts` | Issues found | 1 high |
| `src/modules/location/service.ts` | Issues found | 2 high, 2 medium |
| `src/modules/location/model.ts` | Clean | 0 |
| `src/events/location-event.publisher.ts` | Clean | 0 |
| `src/shared/db.ts` | Issues found | 1 medium |
| `src/shared/redis.ts` | Clean | 0 |
| `src/shared/nats.ts` | Clean | 0 |
| `src/shared/error-handler.ts` | Clean | 0 |
| `src/shared/metrics.ts` | Clean | 0 |
| `src/shared/trace.ts` | Clean | 0 |
| `src/modules/health/index.ts` | Clean | 0 |

---

### HIGH FINDINGS

### HIGH LOC-001: No Authentication on Location Endpoints

- **File**: `src/modules/location/index.ts`
- **Category**: security
- **Impact**: Anyone can update driver locations or query nearby drivers

**Description**

All endpoints are unauthenticated:
```typescript
.post('/update', async ({ body }) => { ... })
.get('/nearby', async ({ query }) => { ... })
.get('/history', async ({ query }) => { ... })
```

No guards or authentication middleware. The service relies on the API Gateway for auth, but direct access would bypass all security.

**Recommendation**

Add internal auth validation since this service should only receive requests from the gateway:
```typescript
import { internalAuthGuard } from '@ain-rider/internal-auth';

export const location = new Elysia({ prefix: '/location' })
  .use(internalAuthGuard)
  .post('/update', ...)
```

Or validate the `x-user-id` header matches the `driverId` in the body.

---

### HIGH LOC-002: Nearby Drivers Only Checks Exact H3 Cell

- **File**: `src/modules/location/service.ts:75-95`
- **Category**: bug
- **Impact**: Nearby drivers in adjacent cells are not found

**Description**

The `getNearbyDrivers` query only checks the exact H3 cell:
```typescript
const centerH3 = latLngToCell(latitude, longitude, H3_RESOLUTION_DISPATCH);

const result = await pgPool.query(
  `SELECT ... FROM driver_locations
   WHERE h3_index = $1
     AND recorded_at > NOW() - INTERVAL '5 minutes'`,
  [centerH3]
);
```

H3 cells are hexagons. A driver 10 meters away across a cell boundary wouldn't be found, while a driver 500 meters away in the same cell would be.

**Recommendation**

Use H3's `gridDisk` to get neighboring cells:
```typescript
import { gridDisk } from 'h3-js';

const centerH3 = latLngToCell(latitude, longitude, H3_RESOLUTION_DISPATCH);
const nearbyCells = gridDisk(centerH3, 2); // k=2 rings for ~5km radius

const result = await pgPool.query(
  `SELECT ... FROM driver_locations
   WHERE h3_index = ANY($1)
     AND recorded_at > NOW() - INTERVAL '5 minutes'`,
  [nearbyCells]
);
```

---

### HIGH LOC-003: Race Condition in Redis Location Update

- **File**: `src/modules/location/service.ts:35-55`
- **Category**: bug
- **Impact**: Stale H3 cell sets could accumulate

**Description**

The location update reads the previous location, then uses a pipeline to update:
```typescript
const prevLocation = await cache.get<{ h3Index?: string }>(`driver:location:${driverId}`);
const pipeline = redisCluster.pipeline();

if (prevLocation?.h3Index && prevLocation.h3Index !== h3Index) {
  pipeline.srem(`h3:drivers:${prevLocation.h3Index}`, driverId);
}
```

Between the `cache.get` and `pipeline.exec`, another update could have changed the driver's location. The `srem` would remove from the wrong cell.

**Recommendation**

Use Lua script for atomic update:
```lua
local prev = redis.call('GET', KEYS[1])
local prevData = cjson.decode(prev or '{}')
local prevH3 = prevData.h3Index

if prevH3 and prevH3 ~= ARGV[2] then
  redis.call('SREM', 'h3:drivers:' .. prevH3, ARGV[1])
end

redis.call('SADD', 'h3:drivers:' .. ARGV[2], ARGV[1])
redis.call('SETEX', KEYS[1], 300, ARGV[3])
return 1
```

---

### MEDIUM FINDINGS

### MEDIUM LOC-004: Database URL Has Hardcoded Fallback

- **File**: `src/shared/db.ts:3`
- **Category**: security
- **Impact**: Development credentials could be used in production

**Description**

```typescript
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ainrider:password@pgbouncer:5432/ainrider';
```

Hardcoded connection string with password in source code.

**Recommendation**

Fail fast or use safe defaults:
```typescript
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
```

---

### MEDIUM LOC-005: Location Update Not Idempotent

- **File**: `src/modules/location/service.ts:25-70`
- **Category**: bug
- **Impact**: Duplicate location records in TimescaleDB on retry

**Description**

The location update writes to TimescaleDB without deduplication:
```typescript
await pgPool.query(
  `INSERT INTO driver_locations (driver_id, latitude, longitude, h3_index, heading, speed, recorded_at)
   VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
  [driverId, latitude, longitude, h3Index, heading ?? null, speed ?? null]
);
```

If the NATS publish fails and the request is retried, duplicate records would be created.

**Recommendation**

Use upsert with a unique constraint on (driver_id, recorded_at) or use an idempotency key:
```sql
INSERT INTO driver_locations (driver_id, latitude, longitude, h3_index, heading, speed, recorded_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (driver_id, recorded_at) DO NOTHING
```

Or use the traceId as an idempotency key.

---

### MEDIUM LOC-006: History Query Has No Date Range Limit

- **File**: `src/modules/location/service.ts:100-115`
- **Category**: performance
- **Impact**: Could query years of data

**Description**

The history query accepts any date range:
```typescript
static async getDriverHistory(driverId: string, from: string, to?: string) {
  const toDate = to ? new Date(to) : new Date();
  // No limit on range
}
```

A query for a year of history could return millions of records.

**Recommendation**

Add a maximum range limit:
```typescript
const MAX_HISTORY_DAYS = 30;
const fromDate = new Date(from);
const rangeMs = toDate.getTime() - fromDate.getTime();

if (rangeMs > MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000) {
  throw new Error(`History range cannot exceed ${MAX_HISTORY_DAYS} days`);
}
```

---

### LOW FINDINGS

### LOW LOC-007: Redis TTL Fixed at 300 Seconds

- **File**: `src/modules/location/service.ts:48`
- **Category**: architecture
- **Impact**: TTL not configurable

**Description**

```typescript
pipeline.setex(`driver:location:${driverId}`, 300, JSON.stringify({ ... }));
```

The 300-second TTL is hardcoded. Different use cases might need different expiry times.

**Recommendation**

Make TTL configurable:
```typescript
const LOCATION_TTL = parseInt(process.env.LOCATION_TTL || '300');
pipeline.setex(`driver:location:${driverId}`, LOCATION_TTL, ...);
```

---

### LOW LOC-008: No Validation of DriverId Format

- **File**: `src/modules/location/model.ts:4-10`
- **Category**: code-quality
- **Impact**: Invalid UUIDs could be stored

**Description**

```typescript
updateBody: t.Object({
  driverId: t.String(),  // No UUID format validation
  latitude: t.Number({ minimum: -90, maximum: 90 }),
  // ...
})
```

**Recommendation**

Add UUID format validation:
```typescript
driverId: t.String({ format: 'uuid' }),
```

Or use a custom regex pattern.

---

### LOW LOC-009: Missing Index on H3 Index Column

- **File**: TimescaleDB schema (not in repo)
- **Category**: performance
- **Impact**: Slow nearby queries

**Description**

The `h3_index` column is queried frequently but may not have an index. The query:
```sql
WHERE h3_index = $1 AND recorded_at > NOW() - INTERVAL '5 minutes'
```

Would benefit from a composite index on `(h3_index, recorded_at)`.

**Recommendation**

Ensure the TimescaleDB hypertable has proper indexes:
```sql
CREATE INDEX idx_driver_locations_h3_recorded ON driver_locations (h3_index, recorded_at DESC);
```

---

### LOW LOC-010: Nearby Query Uses PostgreSQL Instead of Redis

- **File**: `src/modules/location/service.ts:75-95`
- **Category**: architecture
- **Impact**: Unnecessary database load for real-time queries

**Description**

The nearby query uses TimescaleDB:
```typescript
const result = await pgPool.query(
  `SELECT ... FROM driver_locations WHERE h3_index = $1 ...`
);
```

But the Redis `h3:drivers:{h3Index}` sets already contain the active drivers. Querying Redis would be faster for real-time lookups.

**Recommendation**

For real-time nearby queries, use Redis:
```typescript
const driverIds = await redisCluster.smembers(`h3:drivers:${centerH3}`);
const locations = await Promise.all(
  driverIds.map(id => cache.get(`driver:location:${id}`))
);
```

Use TimescaleDB only for historical queries or when Redis data is stale.