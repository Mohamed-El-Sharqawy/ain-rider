# Trip Service Code Review

**Workspace**: backend
**Domain**: trip-service
**Date**: 2026-04-07
**Files Reviewed**: 20+ files

## Summary

The Trip service manages trip lifecycle (request, matching, in-progress, completion, cancellation) and SOS emergencies. It uses NATS for event publishing and request-reply patterns. The service has good separation between controllers, services, and DTOs. However, there are critical issues with state machine validation, missing error handling, race conditions in trip acceptance, and hardcoded fare calculations. The schema uses strings instead of enums for status fields.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/main.ts` | Clean | 0 |
| `src/app.module.ts` | Clean | 0 |
| `src/trips/trips.controller.ts` | Issues found | 2 medium |
| `src/trips/trips.service.ts` | Issues found | 2 high, 3 medium |
| `src/trips/trip-commands.service.ts` | Issues found | 1 medium |
| `src/trips/admin.controller.ts` | Clean | 0 |
| `src/trips/trips.module.ts` | Clean | 0 |
| `src/trips/dto/create-trip.dto.ts` | Clean | 0 |
| `src/trips/dto/estimate-fare.dto.ts` | Clean | 0 |
| `src/trips/dto/cancel-trip.dto.ts` | Clean | 0 |
| `src/trips/dto/rate-trip.dto.ts` | Clean | 0 |
| `src/trips/dto/reject-trip.dto.ts` | Clean | 0 |
| `src/trips/dto/update-trip-status.dto.ts` | Clean | 0 |
| `src/events/trip-event.publisher.ts` | Clean | 0 |
| `src/consumers/trip-matched.consumer.ts` | Issues found | 1 medium |
| `src/nats/responders/trip-create.responder.ts` | Issues found | 1 low |
| `src/nats/responders/trip-cancel.responder.ts` | Clean | 0 |
| `src/nats/responders/trip-assign-driver.responder.ts` | Clean | 0 |
| `src/nats/responders/trip-update-status.responder.ts` | Issues found | 1 low |
| `src/shared/guards/internal-auth.guard.ts` | Clean | 0 |
| `prisma/schema.prisma` | Issues found | 2 medium |

---

### HIGH FINDINGS

### HIGH TRIP-001: No State Machine Validation for Trip Status Transitions

- **File**: `src/trips/trips.service.ts:50-90`
- **Category**: bug
- **Impact**: Invalid status transitions could corrupt trip state

**Description**

The `updateStatus` method allows any status transition without validation:
```typescript
async updateStatus(tripId: string, status: TripStatus, driverId?: string, ...) {
  const data: Prisma.TripUpdateInput = { status };
  // No validation of current status or valid transitions
  const trip = await this.prisma.trip.update({ where: { id: tripId }, data });
```

A trip could go from REQUESTED directly to COMPLETED, bypassing MATCHED and IN_PROGRESS. Or from CANCELLED back to IN_PROGRESS.

**Recommendation**

Implement state machine validation:
```typescript
const VALID_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.REQUESTED]: [TripStatus.MATCHED, TripStatus.CANCELLED, TripStatus.ASSIGNED],
  [TripStatus.ASSIGNED]: [TripStatus.MATCHED, TripStatus.CANCELLED],
  [TripStatus.MATCHED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
};

const currentTrip = await this.prisma.trip.findUnique({ where: { id: tripId } });
if (!VALID_TRANSITIONS[currentTrip.status].includes(status)) {
  throw new BadRequestException(`Invalid transition: ${currentTrip.status} -> ${status}`);
}
```

---

### HIGH TRIP-002: Race Condition in Trip Acceptance

- **File**: `src/trips/trips.service.ts:130-155`
- **Category**: bug
- **Impact**: Multiple drivers could accept the same trip

**Description**

The `acceptTrip` method checks status and then updates, but doesn't use a transaction or lock:
```typescript
async acceptTrip(tripId: string, driverId: string, traceId?: string) {
  const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
  // Check happens here
  if (trip.status !== 'ASSIGNED' && trip.status !== TripStatus.REQUESTED) {
    // Commented out throw - allows fallback
  }
  // Between check and update, another driver could also accept
  const updated = await this.prisma.trip.update({
    where: { id: tripId },
    data: { status: TripStatus.MATCHED, matchedAt: new Date(), driverId },
  });
```

Two drivers could both see the trip as available and both update it, causing a race condition.

**Recommendation**

Use atomic update with condition or optimistic locking:
```typescript
const updated = await this.prisma.trip.updateMany({
  where: { 
    id: tripId,
    status: { in: [TripStatus.ASSIGNED, TripStatus.REQUESTED] }
  },
  data: { status: TripStatus.MATCHED, matchedAt: new Date(), driverId },
});

if (updated.count === 0) {
  throw new ConflictException('Trip already accepted or no longer available');
}
```

---

### MEDIUM FINDINGS

### MEDIUM TRIP-003: Accept Trip Uses Header for Driver ID Instead of Auth Context

- **File**: `src/trips/trips.controller.ts:50-55`
- **Category**: security
- **Impact**: Driver ID can be spoofed by client

**Description**

The accept endpoint uses a header for driver identification:
```typescript
@Patch(':id/accept')
accept(@Param('id') id: string, @Headers('x-driver-id') driverId: string) {
  return this.tripsService.acceptTrip(id, driverId);
}
```

Any driver could impersonate another by setting a different `x-driver-id` header.

**Recommendation**

Use the authenticated user context from the gateway:
```typescript
@Patch(':id/accept')
accept(@Param('id') id: string, @Headers('x-user-id') userId: string) {
  // x-user-id comes from gateway's JWT verification, not client
  return this.tripsService.acceptTrip(id, userId);
}
```

Or add authentication at the trip-service level.

---

### MEDIUM TRIP-004: Hardcoded Fare Calculation Constants

- **File**: `src/trips/trips.service.ts:280-295`
- **Category**: architecture
- **Impact**: Fare changes require code deployment

**Description**

Fare calculation uses hardcoded constants:
```typescript
const baseFare = 2500;
const perKmRate = 1000;
const perMinRate = 200;
const minimumFare = 5000;
```

These values should be configurable from admin settings.

**Recommendation**

Fetch fare rates from settings service or environment:
```typescript
const settings = await this.getFareSettings();
const baseFare = settings.baseFare || 2500;
const perKmRate = settings.perKmRate || 1000;
// ...
```

---

### MEDIUM TRIP-005: Trip Status Not Enforced as Enum in Schema

- **File**: `prisma/schema.prisma:9`
- **Category**: bug
- **Impact**: Invalid status strings could be stored

**Description**

Trip status is a plain string:
```prisma
status String @default("REQUESTED")
```

No database-level validation ensures only valid TripStatus values are stored.

**Recommendation**

Add TripStatus enum:
```prisma
enum TripStatus {
  REQUESTED
  ASSIGNED
  MATCHED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model Trip {
  status TripStatus @default(REQUESTED)
}
```

---

### MEDIUM TRIP-006: Payment Status Not Enforced as Enum

- **File**: `prisma/schema.prisma:14`
- **Category**: bug
- **Impact**: Same as TRIP-005

**Description**

Payment status is a plain string with comment:
```prisma
paymentStatus String @default("PENDING") // PENDING, COLLECTED, FAILED
```

**Recommendation**

Add PaymentStatus enum:
```prisma
enum PaymentStatus {
  PENDING
  COLLECTED
  FAILED
  REFUNDED
}
```

---

### MEDIUM TRIP-007: Accept Trip Silently Ignores Invalid Status

- **File**: `src/trips/trips.service.ts:135-140`
- **Category**: bug
- **Impact**: Accepting trips in invalid states succeeds silently

**Description**

The status check is commented out:
```typescript
if (trip.status !== 'ASSIGNED' && trip.status !== TripStatus.REQUESTED) {
  // Allow REQUESTED as fallback if assignment status didn't propagate
  // throw new Error(`Cannot accept trip in status ${trip.status}`);
}
```

The comment suggests this is intentional for fallback, but it means a trip in COMPLETED or CANCELLED status could be "accepted".

**Recommendation**

At minimum, log a warning and check for truly invalid states:
```typescript
if ([TripStatus.COMPLETED, TripStatus.CANCELLED].includes(trip.status)) {
  throw new BadRequestException(`Cannot accept trip in ${trip.status} status`);
}
console.warn(`[TripsService] Accepting trip in non-standard status: ${trip.status}`);
```

---

### MEDIUM TRIP-008: Missing Error Handling in Trip Assigned Consumer

- **File**: `src/consumers/trip-matched.consumer.ts:55-75`
- **Category**: bug
- **Impact**: Consumer crashes on error, message redelivered but may loop

**Description**

The message handler doesn't have try-catch:
```typescript
async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, traceId: string): Promise<void> {
  const payload = envelope.data as TripMatchedPayload;
  // No try-catch
  await this.tripsService.updateStatus(
    payload.tripId,
    'ASSIGNED' as any,
    payload.driverId,
    traceId,
    { ... }
  );
}
```

If `updateStatus` throws, the consumer will crash or the message will be redelivered indefinitely.

**Recommendation**

Add error handling:
```typescript
async handleMessage(...): Promise<void> {
  try {
    const payload = envelope.data as TripMatchedPayload;
    await this.tripsService.updateStatus(...);
  } catch (error) {
    console.error(`[TripAssignedConsumer] Error processing message | traceId=${traceId}`, error);
    // Let the base class handle DLQ/nak
    throw error;
  }
}
```

---

### MEDIUM TRIP-009: NATS Responders Don't Validate Request Payloads

- **File**: `src/nats/responders/trip-create.responder.ts:50-70`
- **Category**: security
- **Impact**: Malformed requests could cause unexpected behavior

**Description**

NATS responders accept any request without validation:
```typescript
await this.responder.respond<CreateTripRequest, CreateTripResponse>(
  'trip.create.request',
  async (request) => {
    const { riderId, pickupLat, ... } = request;
    // No validation that fields exist or are valid types
```

**Recommendation**

Add validation:
```typescript
async (request) => {
  if (!request.riderId || typeof request.riderId !== 'string') {
    throw new BadRequestException('Invalid riderId');
  }
  // ... more validation
}
```

---

### MEDIUM TRIP-010: Find Many Returns Empty Array Instead of Error

- **File**: `src/trips/trips.controller.ts:95-100`
- **Category**: edge-case
- **Impact**: Client can't distinguish between no results and error

**Description**

When neither riderId nor driverId is provided:
```typescript
findMany(@Query('riderId') riderId?: string, @Query('driverId') driverId?: string) {
  if (riderId) return this.tripsService.findByRider(riderId);
  if (driverId) return this.tripsService.findByDriver(driverId);
  return [];  // Silent empty response
}
```

**Recommendation**

Return an error or require at least one filter:
```typescript
if (!riderId && !driverId) {
  throw new BadRequestException('Either riderId or driverId is required');
}
```

---

### LOW FINDINGS

### LOW TRIP-011: Update Status Responder Returns Wrong Previous Status

- **File**: `src/nats/responders/trip-update-status.responder.ts:55-65`
- **Category**: bug
- **Impact**: Response contains incorrect previousStatus

**Description**

```typescript
return {
  tripId: trip.id,
  previousStatus: trip.status, // This is the NEW status, not previous
  newStatus: trip.status,
};
```

The `previousStatus` field returns the current (new) status instead of the old one.

**Recommendation**

Fetch the trip before update to get previous status:
```typescript
const currentTrip = await this.tripsService.findById(tripId);
const previousStatus = currentTrip.status;
const updatedTrip = await this.tripsService.updateStatus(...);
return { tripId, previousStatus, newStatus: updatedTrip.status };
```

---

### LOW TRIP-012: Missing Indexes for Common Query Patterns

- **File**: `prisma/schema.prisma`
- **Category**: performance
- **Impact**: Slow queries on large trip tables

**Description**

The schema has good indexes but could benefit from composite indexes for common queries:
- Trips by rider with status filter
- Trips by driver with status filter
- Trips by date range

**Recommendation**

Add composite indexes:
```prisma
@@index([riderId, status])
@@index([driverId, status])
@@index([status, requestedAt])
```

---

### LOW TRIP-013: OSRM URL Has Hardcoded Fallback

- **File**: `src/trips/trips.service.ts:255`
- **Category**: code-quality
- **Impact**: Development fallback may be used in production

**Description**

```typescript
const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5000';
```

If OSRM_URL is not set in production, the service will try localhost which won't work.

**Recommendation**

Fail fast or use a sensible default:
```typescript
const OSRM_URL = process.env.OSRM_URL;
if (!OSRM_URL) {
  console.warn('[TripsService] OSRM_URL not set, using haversine fallback');
}
```

---

### LOW TRIP-014: Magic String 'ASSIGNED' Status Used

- **File**: `src/consumers/trip-matched.consumer.ts:65`
- **Category**: code-quality
- **Impact**: Type safety issue

**Description**

```typescript
await this.tripsService.updateStatus(
  payload.tripId,
  'ASSIGNED' as any,  // Type assertion to bypass type check
  payload.driverId,
  ...
);
```

The 'ASSIGNED' status is not in the TripStatus enum but is used in the codebase.

**Recommendation**

Add ASSIGNED to the TripStatus enum in shared-types, or remove this intermediate status if not needed.