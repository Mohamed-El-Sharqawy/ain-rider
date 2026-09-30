# Research: Driver & Rider Onboarding

**Feature**: 005-driver-rider-onboarding
**Date**: 2026-03-28

## Research Tasks

### 1. MinIO Client Pattern in Existing Codebase

**Decision**: Reuse admin-service StorageService pattern, create shared module in auth-service

**Rationale**:

- admin-service already has a mature StorageService with upload, presigned URL generation, delete, and bucket management
- Pattern uses minio npm package with proper error handling and logging
- Configuration via environment variables (MINIO_ENDPOINT, MINIO_ACCESS_KEY, etc.)
- Same bucket "ain-rider" already exists

**Alternatives Considered**:

- Extract to shared package: Rejected - adds complexity, auth-service is the only other service needing MinIO for now
- Use presigned PUT URLs for client-direct upload: Rejected - need server-side validation and MIME type checking

**Implementation Notes**:

- Copy storage.service.ts and storage.config.ts to auth-service/src/shared/storage/
- Create StorageModule for dependency injection
- Presigned GET URLs with configurable TTL (default 1 hour per spec)

---

### 2. Role-Based Guards Pattern

**Decision**: Create DriverGuard and RiderGuard extending JwtAuthGuard

**Rationale**:

- Existing JwtAuthGuard validates JWT and attaches user to request
- Guards should check req.user.role against expected role (DRIVER/RIDER)
- Throw ForbiddenException (403) if role mismatch
- Follows NestJS best practices for role-based access control

**Alternatives Considered**:

- Single RolesGuard with @Roles() decorator: Rejected - adds complexity for 2 simple guards
- Middleware-based role check: Rejected - guards are more idiomatic in NestJS

**Implementation Pattern**:

```typescript
@Injectable()
export class DriverGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user?.role !== "DRIVER") {
      throw new ForbiddenException("Driver access required");
    }
    return true;
  }
}
```

---

### 3. NATS Driver Approved Event

**Decision**: Add DRIVER_APPROVED to shared-types NATS_SUBJECTS, publish via existing NatsService

**Rationale**:

- Existing NatsService in auth-service already has publisher capability
- AIN_RIDER_AUTH stream already exists for user events
- Pattern follows existing USER_CREATED, USER_UPDATED events

**Event Schema**:

```typescript
export const NATS_SUBJECTS = {
  // ... existing
  DRIVER_APPROVED: "ain_rider.driver.approved",
};

export interface DriverApprovedEvent {
  subject: typeof NATS_SUBJECTS.DRIVER_APPROVED;
  data: {
    driverId: string;
    userId: string;
    vehicleId: string | null;
    timestamp: string;
  };
}
```

---

### 4. Prisma Schema Changes

**Decision**: Add DriverDocument, Vehicle models; extend Driver with onboardingStatus; remove isOnline

**Rationale**:

- One-to-one relationship between Driver and DriverDocument
- One-to-one (optional) between Driver and Vehicle via vehicleId
- Enum for onboardingStatus matches spec exactly
- isOnline removal per architecture decision (managed by location-service in Redis)

**Migration Strategy**:

1. Create migration for new tables and enums
2. Add onboardingStatus to Driver with default PENDING_DOCUMENTS
3. Remove isOnline field (data loss acceptable - managed in Redis)
4. Run prisma generate after migration

---

### 5. File Upload Validation

**Decision**: Use NestJS FileInterceptor with custom file filter for MIME type validation

**Rationale**:

- Built-in NestJS support via @nestjs/platform-express
- Memory storage for small files (10MB limit), process immediately
- Custom file filter validates MIME type: image/jpeg, image/png, image/webp
- Size limit enforced via Multer options

**Alternatives Considered**:

- Direct MinIO presigned PUT: Rejected - can't validate MIME type server-side
- Stream to temp file: Rejected - unnecessary complexity for 10MB limit

**Implementation Pattern**:

```typescript
const imageFileFilter = (req, file, callback) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.mimetype)) {
    return callback(new BadRequestException("Invalid file type"), false);
  }
  callback(null, true);
};
```

---

### 6. Concurrent Document Upload Handling

**Decision**: Use Prisma transaction with upsert for document records

**Rationale**:

- Single driver uploading documents concurrently should not create duplicate records
- Upsert ensures idempotent operation
- Prisma transaction wraps upload + database update atomically

**Implementation**:

```typescript
await this.prisma.$transaction(async (tx) => {
  // Upload to MinIO first (can fail safely)
  const uploadedKeys = await this.storage.uploadMultiple(files);

  // Then update database atomically
  await tx.driverDocument.upsert({
    where: { driverId },
    create: {
      driverId,
      identityImages: uploadedKeys,
      identityStatus: "PENDING",
    },
    update: { identityImages: uploadedKeys, identityStatus: "PENDING" },
  });
});
```

---

### 7. Onboarding Status Transition Logic

**Decision**: Check document completion in service layer, auto-transition via transaction

**Rationale**:

- Three document types required: identity, driving license, vehicle
- Each upload endpoint checks if this was the final piece
- If all complete, transition Driver.onboardingStatus to UNDER_REVIEW
- Single source of truth in service method

**Status Check Logic**:

```typescript
private async checkAndTransitionToUnderReview(driverId: string, tx: PrismaTx) {
  const doc = await tx.driverDocument.findUnique({ where: { driverId } });
  const driver = await tx.driver.findUnique({
    where: { id: driverId },
    include: { vehicle: true }
  });

  const hasIdentity = doc?.identityImages?.length === 3;
  const hasLicense = doc?.drivingLicenseImages?.length === 2;
  const hasVehicle = !!driver?.vehicleId;

  if (hasIdentity && hasLicense && hasVehicle) {
    await tx.driver.update({
      where: { id: driverId },
      data: { onboardingStatus: 'UNDER_REVIEW' }
    });
  }
}
```

---

## Summary

All NEEDS CLARIFICATION items resolved:

- MinIO pattern: Reuse admin-service StorageService
- Guards: Create DriverGuard/RiderGuard extending JwtAuthGuard
- NATS event: Add DRIVER_APPROVED to shared-types
- Schema: Add DriverDocument, Vehicle, onboardingStatus; remove isOnline
- Upload validation: NestJS FileInterceptor with MIME type filter
- Concurrency: Prisma transactions with upsert
- Status transitions: Service-layer logic with transactional check
