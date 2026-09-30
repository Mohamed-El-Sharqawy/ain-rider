# Data Model: NATS Inter-Service Communication Refactor

**Feature**: 002-nats-interservice-refactor  
**Date**: 2026-03-24

## Overview

This document defines the event schemas, stream configurations, and data structures for the NATS-based inter-service communication layer.

---

## 1. JetStream Streams

### AIN_RIDER_OPS (Operational Events)

| Property | Value |
|----------|-------|
| Name | AIN_RIDER_OPS |
| Retention | Limits |
| Max Age | 7 days |
| Storage | File |
| Replicas | 3 |
| Discard | Old |

**Subjects:**

- `ain_rider.trip_requested`
- `ain_rider.trip_matched`
- `ain_rider.trip_started`
- `ain_rider.trip_completed`
- `ain_rider.trip_cancelled`
- `ain_rider.trip_no_match`
- `ain_rider.sos_created`
- `ain_rider.sos_resolved`
- `ain_rider.user_created`
- `ain_rider.user_updated`
- `ain_rider.user_status_changed`
- `ain_rider.user_deleted`
- `ain_rider.location_update`
- `ain_rider.notification_sent`
- `ain_rider.complaint_created`
- `ain_rider.complaint_updated`

### AIN_RIDER_FINANCIAL (Financial Events)

| Property | Value |
|----------|-------|
| Name | AIN_RIDER_FINANCIAL |
| Retention | Limits |
| Max Age | 30 days |
| Storage | File |
| Replicas | 3 |
| Discard | Old |

**Subjects:**

- `ain_rider.payment_processed`
- `ain_rider.wallet_updated`
- `ain_rider.withdrawal_requested`
- `ain_rider.withdrawal_processed`

### AIN_RIDER_DLQ (Dead Letter Queue)

| Property | Value |
|----------|-------|
| Name | AIN_RIDER_DLQ |
| Retention | Limits |
| Max Age | 30 days |
| Storage | File |
| Replicas | 3 |
| Discard | Old |

**Subjects:**

- `ain_rider.dlq.*`

---

## 2. Event Envelope Schema

All events follow this envelope structure:

```typescript
interface EventEnvelope<T> {
  version: number;           // Schema version (starts at 1)
  eventType: string;         // e.g., "trip_requested"
  eventId: string;           // UUID for idempotency
  timestamp: string;         // ISO 8601
  traceId: string;           // W3C trace ID
  source: string;            // Service name
  data: T;                   // Event-specific payload
}
```

---

## 3. Event Schemas

### Trip Events

#### TripRequestedEvent

```typescript
interface TripRequestedEvent {
  tripId: string;
  riderId: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  vehicleType: VehicleType;
  estimatedFare: number;
  requestedAt: string;
}

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  h3Index: string;  // Resolution 8
}

type VehicleType = 'SEDAN' | 'SUV' | 'LUXURY' | 'MOTORCYCLE';
```

#### TripMatchedEvent

```typescript
interface TripMatchedEvent {
  tripId: string;
  riderId: string;
  driverId: string;
  vehicleId: string;
  estimatedArrival: number;  // Minutes
  matchedAt: string;
}
```

#### TripStartedEvent

```typescript
interface TripStartedEvent {
  tripId: string;
  riderId: string;
  driverId: string;
  startLocation: Location;
  startedAt: string;
}
```

#### TripCompletedEvent

```typescript
interface TripCompletedEvent {
  tripId: string;
  riderId: string;
  driverId: string;
  endLocation: Location;
  distanceKm: number;
  durationMinutes: number;
  fare: number;
  completedAt: string;
}
```

#### TripCancelledEvent

```typescript
interface TripCancelledEvent {
  tripId: string;
  riderId: string;
  driverId?: string;
  cancelledBy: 'RIDER' | 'DRIVER' | 'SYSTEM' | 'ADMIN';
  reason?: string;
  cancellationFee?: number;
  cancelledAt: string;
}
```

#### TripNoMatchEvent

```typescript
interface TripNoMatchEvent {
  tripId: string;
  riderId: string;
  searchRadius: number;
  driversSearched: number;
  reason: 'NO_DRIVERS' | 'ALL_BUSY' | 'TIMEOUT';
  failedAt: string;
}
```

### SOS Events

#### SOSCreatedEvent

```typescript
interface SOSCreatedEvent {
  sosId: string;
  tripId: string;
  triggeredBy: 'RIDER' | 'DRIVER';
  userId: string;
  location: Location;
  createdAt: string;
}
```

#### SOSResolvedEvent

```typescript
interface SOSResolvedEvent {
  sosId: string;
  tripId: string;
  resolvedBy: string;  // Admin user ID
  resolution: string;
  resolvedAt: string;
}
```

### User Events

#### UserCreatedEvent

```typescript
interface UserCreatedEvent {
  userId: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

type UserRole = 'RIDER' | 'DRIVER' | 'ADMIN' | 'SUPPORT';
type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';
```

#### UserUpdatedEvent

```typescript
interface UserUpdatedEvent {
  userId: string;
  changes: Partial<{
    email: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    profileImage: string;
  }>;
  updatedBy?: string;
  updatedAt: string;
}
```

#### UserStatusChangedEvent

```typescript
interface UserStatusChangedEvent {
  userId: string;
  previousStatus: UserStatus;
  newStatus: UserStatus;
  reason?: string;
  changedBy?: string;
  changedAt: string;
}
```

#### UserDeletedEvent

```typescript
interface UserDeletedEvent {
  userId: string;
  deletedBy?: string;
  reason?: string;
  deletedAt: string;
}
```

### Location Events

#### LocationUpdateEvent

```typescript
interface LocationUpdateEvent {
  driverId: string;
  location: Location;
  heading: number;      // Degrees 0-360
  speed: number;        // km/h
  accuracy: number;     // Meters
  batteryLevel?: number;
  isOnline: boolean;
  updatedAt: string;
}
```

### Payment Events

#### PaymentProcessedEvent

```typescript
interface PaymentProcessedEvent {
  paymentId: string;
  tripId: string;
  riderId: string;
  driverId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  processedAt: string;
}

type PaymentMethod = 'CASH' | 'CARD' | 'WALLET';
type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
```

#### WalletUpdatedEvent

```typescript
interface WalletUpdatedEvent {
  walletId: string;
  userId: string;
  previousBalance: number;
  newBalance: number;
  changeAmount: number;
  changeType: 'CREDIT' | 'DEBIT';
  reason: string;
  referenceId?: string;
  updatedAt: string;
}
```

#### WithdrawalRequestedEvent

```typescript
interface WithdrawalRequestedEvent {
  withdrawalId: string;
  driverId: string;
  amount: number;
  bankAccount: string;
  requestedAt: string;
}
```

#### WithdrawalProcessedEvent

```typescript
interface WithdrawalProcessedEvent {
  withdrawalId: string;
  driverId: string;
  amount: number;
  status: 'COMPLETED' | 'FAILED';
  transactionRef?: string;
  failureReason?: string;
  processedAt: string;
}
```

### Notification Events

#### NotificationSentEvent

```typescript
interface NotificationSentEvent {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  sentAt: string;
}

type NotificationType = 'TRIP' | 'PAYMENT' | 'PROMO' | 'SYSTEM' | 'SOS';
type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL' | 'IN_APP';
```

### Complaint Events

#### ComplaintCreatedEvent

```typescript
interface ComplaintCreatedEvent {
  complaintId: string;
  tripId?: string;
  reporterId: string;
  reporterRole: UserRole;
  againstId?: string;
  category: string;
  description: string;
  createdAt: string;
}
```

#### ComplaintUpdatedEvent

```typescript
interface ComplaintUpdatedEvent {
  complaintId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  resolution?: string;
  handledBy?: string;
  updatedAt: string;
}
```

---

## 4. Request/Reply Schemas

### User Requests

#### SuspendUserRequest/Response

```typescript
interface SuspendUserRequest {
  userId: string;
  reason: string;
  suspendedBy: string;
}

interface SuspendUserResponse {
  success: boolean;
  userId: string;
  newStatus: UserStatus;
  error?: { code: string; message: string };
}
```

#### ActivateUserRequest/Response

```typescript
interface ActivateUserRequest {
  userId: string;
  activatedBy: string;
}

interface ActivateUserResponse {
  success: boolean;
  userId: string;
  newStatus: UserStatus;
  error?: { code: string; message: string };
}
```

### Trip Requests

#### CancelTripRequest/Response

```typescript
interface CancelTripRequest {
  tripId: string;
  reason: string;
  cancelledBy: string;
}

interface CancelTripResponse {
  success: boolean;
  tripId: string;
  newStatus: string;
  cancellationFee?: number;
  error?: { code: string; message: string };
}
```

#### AssignDriverRequest/Response

```typescript
interface AssignDriverRequest {
  tripId: string;
  driverId: string;
  assignedBy: string;
}

interface AssignDriverResponse {
  success: boolean;
  tripId: string;
  driverId: string;
  error?: { code: string; message: string };
}
```

### Payment Requests

#### RefundRequest/Response

```typescript
interface RefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  requestedBy: string;
}

interface RefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  error?: { code: string; message: string };
}
```

#### AdjustPaymentRequest/Response

```typescript
interface AdjustPaymentRequest {
  paymentId: string;
  adjustmentAmount: number;
  reason: string;
  adjustedBy: string;
}

interface AdjustPaymentResponse {
  success: boolean;
  paymentId: string;
  newAmount: number;
  error?: { code: string; message: string };
}
```

---

## 5. DLQ Message Schema

```typescript
interface DLQMessage {
  originalSubject: string;
  originalPayload: unknown;
  originalHeaders: Record<string, string>;
  errorReason: string;
  errorStack?: string;
  retryCount: number;
  consumerName: string;
  failedAt: string;
  traceId: string;
}
```

---

## 6. Redis Data Structures

### Driver Pool

```text
Key: match:h3:cell:{h3_index}
Type: Set
Value: Set of driver IDs in this H3 cell
TTL: None (managed by location service)

Key: match:driver:available:{driver_id}
Type: Hash
Fields:
  - status: "AVAILABLE" | "BUSY" | "OFFLINE"
  - vehicleType: "SEDAN" | "SUV" | "LUXURY" | "MOTORCYCLE"
  - vehicleId: string
  - rating: number
  - lastUpdate: timestamp
TTL: 5 minutes (auto-expire if no updates)

Key: driver:location:{driver_id}
Type: Geo
Value: longitude, latitude
TTL: None (overwritten on each update)
```

### Idempotency Keys

```text
Key: idempotency:{consumer_name}:{event_id}
Type: String
Value: Processing timestamp
TTL: 7 days (matches operational stream retention)
```

### Trip Matching Lock

```text
Key: trip:matching:{trip_id}
Type: String
Value: Driver ID being matched
TTL: 30 seconds (prevent double-matching)
```

---

## 7. Consumer Configuration

| Consumer Name | Stream | Filter | Max Deliver | Ack Wait |
|---------------|--------|--------|-------------|----------|
| trip-matched-consumer | AIN_RIDER_OPS | ain_rider.trip_matched | 3 | 30s |
| trip-requested-consumer | AIN_RIDER_OPS | ain_rider.trip_requested | 3 | 30s |
| trip-completed-consumer | AIN_RIDER_FINANCIAL | ain_rider.trip_completed | 3 | 30s |
| ws-location-consumer | AIN_RIDER_OPS | ain_rider.location_update | 1 | 5s |
| ws-trip-consumer | AIN_RIDER_OPS | ain_rider.trip_* | 1 | 5s |
| ws-payment-consumer | AIN_RIDER_FINANCIAL | ain_rider.payment_processed | 1 | 5s |
| ws-sos-consumer | AIN_RIDER_OPS | ain_rider.sos_* | 1 | 5s |

---

## 8. State Transitions

### Trip Status Flow

```
REQUESTED → MATCHED → STARTED → COMPLETED
    ↓          ↓         ↓
    └──────────┴─────────┴──→ CANCELLED
    ↓
NO_MATCH
```

### User Status Flow

```
ACTIVE ←→ INACTIVE
   ↓         ↓
   └────→ SUSPENDED ←────┘
              ↓
           BANNED
```

### Payment Status Flow

```
PENDING → COMPLETED
    ↓         ↓
  FAILED   REFUNDED
```
