# Prisma Schemas Code Review

**Workspace**: backend
**Domain**: prisma-schemas
**Date**: 2026-04-07
**Schemas Reviewed**: 4 services

## Summary

The Prisma schemas define the database models for auth-service, trip-service, payment-service, and admin-service. Each service has its own database following the microservices pattern. The schemas are well-structured with proper indexes and relationships. However, there are issues with string-based enums instead of native Prisma enums, missing composite indexes for common query patterns, inconsistent field naming across services, and missing soft delete support.

## Schemas Covered

| Schema | Status | Findings |
|--------|--------|----------|
| `auth-service/prisma/schema.prisma` | Issues found | 3 medium, 2 low |
| `trip-service/prisma/schema.prisma` | Issues found | 2 medium, 2 low |
| `payment-service/prisma/schema.prisma` | Issues found | 2 medium, 1 low |
| `admin-service/prisma/schema.prisma` | Issues found | 4 medium, 3 low |

---

## auth-service Schema

### Models

- `User` - Core user entity with profile data
- `RefreshToken` - JWT refresh token storage
- `Driver` - Driver-specific data with onboarding
- `DriverDocument` - Document verification
- `Vehicle` - Driver vehicles
- `Rider` - Rider-specific data

### MEDIUM FINDINGS

### MEDIUM AUTH-DB-001: Role and Status Fields Are Strings

- **File**: `auth-service/prisma/schema.prisma:25-30`
- **Category**: bug
- **Impact**: Invalid values could be stored

**Description**

```prisma
model User {
  role    String
  status  String   @default("ACTIVE")
  // ...
}
```

Role and status are strings instead of enums. This allows invalid values like "SUPERADMIN" or "UNKNOWN_STATUS".

**Recommendation**

Use Prisma enums:
```prisma
enum UserRole {
  RIDER
  DRIVER
  SUPPORT
  ADMIN
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  BANNED
}

model User {
  role    UserRole
  status  UserStatus @default(ACTIVE)
  // ...
}
```

---

### MEDIUM AUTH-DB-002: Missing Index on Driver Onboarding Status

- **File**: `auth-service/prisma/schema.prisma:50-65`
- **Category**: performance
- **Impact**: Slow queries for pending driver reviews

**Description**

```prisma
model Driver {
  onboardingStatus OnboardingStatus @default(PENDING_DOCUMENTS)
  // No index on onboardingStatus
}
```

Admin queries for drivers pending review would be slow.

**Recommendation**

```prisma
@@index([onboardingStatus])
```

---

### MEDIUM AUTH-DB-003: Vehicle Model Missing Make/Model Index

- **File**: `auth-service/prisma/schema.prisma:85-100`
- **Category**: performance
- **Impact**: Slow vehicle lookups

**Description**

```prisma
model Vehicle {
  make        String
  model       String
  plateNumber String  @unique
  // No index on make + model
}
```

**Recommendation**

```prisma
@@index([make, model])
```

---

### LOW FINDINGS

### LOW AUTH-DB-004: No Soft Delete Support

- **File**: All models
- **Category**: architecture
- **Impact**: Cannot recover deleted data

**Description**

Models use `onDelete: Cascade` but have no soft delete mechanism.

**Recommendation**

Add soft delete fields:
```prisma
model User {
  // ...
  deletedAt DateTime?
  deletedBy String?
  
  @@index([deletedAt])
}
```

---

### LOW AUTH-DB-005: Missing Composite Index on RefreshToken

- **File**: `auth-service/prisma/schema.prisma:35-50`
- **Category**: performance
- **Impact**: Token family rotation queries may be slow

**Description**

```prisma
model RefreshToken {
  userId    String
  tokenHash String   @unique
  family    String
  // ...
  @@index([userId, family])
}
```

The index exists, but `family` should also be indexed alone for family rotation queries.

**Recommendation**

```prisma
@@index([family])
```

---

## trip-service Schema

### Models

- `Trip` - Core trip entity with full lifecycle
- `SOS` - Emergency alerts

### MEDIUM FINDINGS

### MEDIUM TRIP-DB-001: Trip Status Is String Instead of Enum

- **File**: `trip-service/prisma/schema.prisma:10-15`
- **Category**: bug
- **Impact**: Invalid status values could be stored

**Description**

```prisma
model Trip {
  status        String    @default("REQUESTED")
  paymentMethod String    @default("CASH")
  paymentStatus String    @default("PENDING")
  // ...
}
```

All status fields are strings.

**Recommendation**

```prisma
enum TripStatus {
  REQUESTED
  ASSIGNED
  MATCHED
  DRIVER_ARRIVING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PaymentMethod {
  CASH
  CARD
  WALLET
}

enum TripPaymentStatus {
  PENDING
  COLLECTED
  FAILED
}

model Trip {
  status        TripStatus        @default(REQUESTED)
  paymentMethod PaymentMethod     @default(CASH)
  paymentStatus TripPaymentStatus @default(PENDING)
  // ...
}
```

---

### MEDIUM TRIP-DB-002: Missing Composite Index for Driver Status Queries

- **File**: `trip-service/prisma/schema.prisma:10-45`
- **Category**: performance
- **Impact**: Slow queries for driver's active trips

**Description**

```prisma
@@index([driverId])
@@index([status])
```

Common query: "Get all active trips for a driver" needs a composite index.

**Recommendation**

```prisma
@@index([driverId, status])
@@index([riderId, status])
```

---

### LOW FINDINGS

### LOW TRIP-DB-003: Driver Info Duplicated in Trip

- **File**: `trip-service/prisma/schema.prisma:30-35`
- **Category**: data-quality
- **Impact**: Data could become stale

**Description**

```prisma
model Trip {
  driverName   String?
  driverPhone  String?
  vehicleMake  String?
  vehicleModel String?
  vehiclePlate String?
}
```

Driver info is duplicated in Trip. If driver updates their profile, trip records won't reflect changes.

**Recommendation**

This may be intentional for historical accuracy. If so, document this decision. Otherwise, consider storing only `driverId` and joining with auth-service data.

---

### LOW TRIP-DB-004: SOS Model Missing Location Index

- **File**: `trip-service/prisma/schema.prisma:50-65`
- **Category**: performance
- **Impact**: Location-based SOS queries may be slow

**Description**

```prisma
model SOS {
  lat    Float
  lng    Float
  // No spatial index
}
```

For location-based SOS queries, a spatial index would help.

**Recommendation**

Consider PostGIS extension for spatial queries:
```prisma
// Requires PostGIS extension
// @@index([location]) // PostGIS GiST index
```

Or at minimum, add a composite index for common queries:
```prisma
@@index([status, createdAt])
```

---

## payment-service Schema

### Models

- `Payment` - Payment records
- `Refund` - Refund records

### MEDIUM FINDINGS

### MEDIUM PAY-DB-001: Payment Status Is String

- **File**: `payment-service/prisma/schema.prisma:10-20`
- **Category**: bug
- **Impact**: Invalid status values could be stored

**Description**

```prisma
model Payment {
  status String @default("PENDING")
  // ...
}
```

**Recommendation**

```prisma
enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REFUNDED
}

model Payment {
  status PaymentStatus @default(PENDING)
  // ...
}
```

---

### MEDIUM PAY-DB-002: Missing Unique Constraint on Refund

- **File**: `payment-service/prisma/schema.prisma:25-35`
- **Category**: bug
- **Impact**: Duplicate refunds could be created

**Description**

```prisma
model Refund {
  id        String   @id @default(uuid())
  paymentId String
  amount    Float
  // No unique constraint on paymentId + amount or similar
}
```

Multiple refunds could be created for the same payment.

**Recommendation**

Add unique constraint or check:
```prisma
model Refund {
  paymentId String
  amount    Float
  
  @@unique([paymentId, amount])
  // Or use a referenceId for idempotency
}
```

---

### LOW FINDINGS

### LOW PAY-DB-003: Missing Index on Payment CreatedAt

- **File**: `payment-service/prisma/schema.prisma:10-25`
- **Category**: performance
- **Impact**: Slow time-based queries

**Description**

```prisma
model Payment {
  createdAt DateTime @default(now())
  // No index
}
```

Time-based queries (daily reports, etc.) would be slow.

**Recommendation**

```prisma
@@index([createdAt])
@@index([status, createdAt])
```

---

## admin-service Schema

### Models

- `UserShadow` - Synced user data from auth-service
- `VehicleType`, `VehicleMake`, `VehicleModel`, `Vehicle` - Vehicle hierarchy
- `Wallet`, `WalletTransaction`, `Withdrawal` - Financial models
- `Promo`, `PromoUsage` - Promotional codes
- `Notification`, `NotificationRead` - Notifications
- `SOS` - Emergency alerts (duplicate of trip-service)
- `Complaint`, `ComplaintComment` - Support tickets
- `Setting` - System settings
- `Booking` - Scheduled rides
- `AdminAuditLog` - Audit trail

### MEDIUM FINDINGS

### MEDIUM ADMIN-DB-001: SOS Model Duplicated from trip-service

- **File**: `admin-service/prisma/schema.prisma:145-165`
- **Category**: architecture
- **Impact**: Data inconsistency, duplicate maintenance

**Description**

The admin-service has its own `SOS` model that differs from trip-service's SOS:
```prisma
// admin-service SOS
model SOS {
  priority          String    @default("CRITICAL")
  emergencyContacts Json
  respondedBy       String?
  // ...
}

// trip-service SOS
model SOS {
  userType String // RIDER, DRIVER
  reason   String?
  // ...
}
```

**Recommendation**

Either:
1. Have admin-service query trip-service's SOS data via API
2. Or clearly document the sync mechanism between the two

---

### MEDIUM ADMIN-DB-002: Multiple String Status Fields

- **File**: `admin-service/prisma/schema.prisma` (multiple models)
- **Category**: bug
- **Impact**: Invalid status values could be stored

**Description**

Multiple models use string status fields:
- `WalletTransaction.status` - String
- `Withdrawal.status` - String
- `Promo.status` - String
- `Promo.type` - String
- `Notification.status` - String
- `SOS.status` - String
- `Complaint.status` - String
- `Vehicle.status` - String

**Recommendation**

Define enums for each status type:
```prisma
enum WalletTransactionStatus {
  PENDING
  COMPLETED
  FAILED
}

enum WithdrawalStatus {
  PENDING
  APPROVED
  REJECTED
  PROCESSING
  COMPLETED
}

enum PromoStatus {
  ACTIVE
  INACTIVE
  EXPIRED
}

enum PromoType {
  PERCENTAGE
  FIXED
}
```

---

### MEDIUM ADMIN-DB-003: Missing Composite Index on PromoUsage

- **File**: `admin-service/prisma/schema.prisma:130-140`
- **Category**: performance
- **Impact**: Slow promo validation queries

**Description**

```prisma
model PromoUsage {
  promoId String
  userId  String
  tripId  String
  // ...
  @@index([userId])
}
```

Missing composite index for checking user's usage of a promo.

**Recommendation**

```prisma
@@index([promoId, userId])
```

---

### MEDIUM ADMIN-DB-004: WalletTransaction Missing Type Index

- **File**: `admin-service/prisma/schema.prisma:95-110`
- **Category**: performance
- **Impact**: Slow transaction type queries

**Description**

```prisma
model WalletTransaction {
  type String
  // ...
  @@index([userId])
  @@index([walletId])
}
```

Missing index on transaction type for filtering.

**Recommendation**

```prisma
@@index([type])
@@index([walletId, type])
```

---

### LOW FINDINGS

### LOW ADMIN-DB-005: UserShadow Missing Sync Status

- **File**: `admin-service/prisma/schema.prisma:15-30`
- **Category**: observability
- **Impact**: Cannot detect sync failures

**Description**

```prisma
model UserShadow {
  id       String   @id
  syncedAt DateTime @default(now())
  // No sync status or error tracking
}
```

**Recommendation**

Add sync tracking:
```prisma
model UserShadow {
  syncStatus  String   @default("SYNCED") // SYNCED, FAILED, STALE
  syncError   String?
  lastSyncAt  DateTime @default(now())
}
```

---

### LOW ADMIN-DB-006: Setting Value Is String

- **File**: `admin-service/prisma/schema.prisma:195-205`
- **Category**: architecture
- **Impact**: Type coercion issues

**Description**

```prisma
model Setting {
  value String
  type  String
}
```

All values are stored as strings, requiring parsing on retrieval.

**Recommendation**

This is a common pattern for flexible settings. Ensure the `type` field is used for validation:
```prisma
enum SettingType {
  STRING
  NUMBER
  BOOLEAN
  JSON
}

model Setting {
  value String
  type  SettingType
}
```

---

### LOW ADMIN-DB-007: Booking Missing ScheduledAt Index

- **File**: `admin-service/prisma/schema.prisma:210-225`
- **Category**: performance
- **Impact**: Slow scheduled booking queries

**Description**

```prisma
model Booking {
  scheduledAt DateTime?
  status      String    @default("PENDING")
  // ...
  @@index([status])
}
```

Missing index on `scheduledAt` for finding upcoming bookings.

**Recommendation**

```prisma
@@index([scheduledAt])
@@index([status, scheduledAt])
```

---

## Cross-Schema Issues

### SCHEMA-CROSS-001: Inconsistent Field Naming

- **Category**: code-quality
- **Impact**: Confusion when working across services

**Description**

Field naming inconsistencies:
- `lat/lng` vs `latitude/longitude` vs `pickupLat/pickupLng`
- `createdAt` vs `requestedAt` vs `syncedAt`
- `driverId` vs `againstUserId` vs `complainantId`

**Recommendation**

Establish naming conventions:
- Use `latitude/longitude` consistently (or `lat/lng`)
- Use `createdAt` for entity creation, `timestamp` for events
- Use `{entity}Id` pattern for foreign keys

---

### SCHEMA-CROSS-002: No Database Documentation

- **Category**: documentation
- **Impact**: Hard to understand data model

**Description**

No `///` documentation comments on models or fields.

**Recommendation**

Add documentation:
```prisma
/// Core user entity, managed by auth-service
/// Synced to admin-service via NATS USER_* events
model User {
  /// Unique identifier, UUID v4
  id String @id @default(uuid())
  
  /// User's email address, must be unique
  /// Used for login and notifications
  email String @unique
}
```

---

### SCHEMA-CROSS-003: Missing Migration Strategy

- **Category**: architecture
- **Impact**: Schema changes could break services

**Description**

No documented strategy for schema migrations across microservices.

**Recommendation**

Document migration approach:
1. Backward-compatible changes only
2. New fields optional with defaults
3. Deprecation period for removed fields
4. Cross-service coordination for foreign key changes