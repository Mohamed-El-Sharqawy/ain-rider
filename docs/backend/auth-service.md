# Auth Service Code Review

**Workspace**: backend
**Domain**: auth-service
**Date**: 2026-04-07
**Files Reviewed**: 30+ files

## Summary

The Auth service implements authentication with JWT tokens, refresh token rotation, OTP verification via Firebase, and driver onboarding with document uploads. The architecture is well-structured with proper separation of concerns. However, there are critical security issues with hardcoded JWT secrets, missing validation in admin routes, and potential race conditions in refresh token handling. The Firebase OTP provider is non-functional (throws errors), and the circuit breaker implementation has a logic bug.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/main.ts` | Clean | 0 |
| `src/app.module.ts` | Clean | 0 |
| `src/auth/auth.controller.ts` | Issues found | 1 medium |
| `src/auth/auth.service.ts` | Issues found | 2 high, 2 medium |
| `src/auth/auth.module.ts` | Issues found | 1 critical |
| `src/auth/jwt.strategy.ts` | Issues found | 1 critical |
| `src/auth/jwt-auth.guard.ts` | Clean | 0 |
| `src/auth/admin.controller.ts` | Issues found | 1 high |
| `src/auth/firebase.service.ts` | Clean | 0 |
| `src/auth/otp.service.ts` | Issues found | 1 high, 1 medium |
| `src/auth/guards/internal-auth.guard.ts` | Clean | 0 |
| `src/auth/guards/driver.guard.ts` | Clean | 0 |
| `src/auth/guards/rider.guard.ts` | Clean | 0 |
| `src/auth/dto/login.dto.ts` | Clean | 0 |
| `src/auth/dto/register.dto.ts` | Clean | 0 |
| `src/auth/otp-providers/firebase.provider.ts` | Issues found | 1 high |
| `src/auth/otp-providers/console.provider.ts` | Clean | 0 |
| `src/driver-onboarding/driver-onboarding.controller.ts` | Issues found | 1 medium |
| `src/driver-onboarding/driver-onboarding.service.ts` | Issues found | 2 medium, 1 low |
| `src/rider-profile/rider-profile.controller.ts` | Issues found | 1 low |
| `src/rider-profile/rider-profile.service.ts` | Clean | 0 |
| `src/shared/storage/storage.service.ts` | Clean | 0 |
| `src/shared/filters/global-exception.filter.ts` | Clean | 0 |
| `src/events/user-event.publisher.ts` | Clean | 0 |
| `src/events/driver-event.publisher.ts` | Clean | 0 |
| `src/nats/responders/user-suspend.responder.ts` | Issues found | 1 medium |
| `src/nats/responders/user-activate.responder.ts` | Issues found | 1 medium |
| `prisma/schema.prisma` | Issues found | 2 medium |

---

### CRITICAL FINDINGS

### CRITICAL AUTH-001: JWT Secret Has Hardcoded Fallback

- **File**: `src/auth/auth.module.ts:26-27` and `src/auth/jwt.strategy.ts:12`
- **Category**: security
- **Impact**: Production deployments may use weak default secret, allowing token forgery

**Description**

Both the JwtModule configuration and JwtStrategy use the same hardcoded fallback:
```typescript
// auth.module.ts
const secret = config.get<string>("JWT_SECRET") || "change-me-in-production";

// jwt.strategy.ts
const secret = config.get<string>('JWT_SECRET') || 'change-me-in-production';
```

If `JWT_SECRET` is not set, the application silently uses a known default value. An attacker could forge valid JWT tokens.

**Recommendation**

Fail fast on startup if the secret is not configured:
```typescript
const secret = config.getOrThrow<string>("JWT_SECRET");
```

---

### HIGH FINDINGS

### HIGH AUTH-002: Refresh Token Race Condition

- **File**: `src/auth/auth.service.ts:50-70`
- **Category**: bug
- **Impact**: Concurrent refresh requests could invalidate the token family, logging user out

**Description**

The refresh token flow:
1. Validates token
2. Marks old token as revoked
3. Stores new token

Between steps 1 and 2, another concurrent request could use the same token, triggering the reuse detection logic and revoking the entire family:
```typescript
if (storedToken.revoked) {
  // Reuse detected - revoke entire family
  await this.prisma.refreshToken.updateMany({
    where: { family: storedToken.family },
    data: { revoked: true },
  });
  return null;
}
```

This would log the user out unexpectedly.

**Recommendation**

Use database-level locking or atomic operations:
```typescript
// Use a transaction with SELECT FOR UPDATE
const result = await this.prisma.$transaction(async (tx) => {
  const storedToken = await tx.refreshToken.findUnique({
    where: { tokenHash },
  });
  // ... rest of logic
});
```

Or use a Redis lock around refresh operations.

---

### HIGH AUTH-003: Admin Update User Route Has No Body Validation

- **File**: `src/auth/admin.controller.ts:35-38`
- **Category**: security
- **Impact**: Malicious data could be injected into user records

**Description**

The admin user update endpoint accepts `any` type for the body:
```typescript
@Patch('users/:id')
async updateUser(@Param('id') id: string, @Body() data: any) {
  return this.authService.updateUser(id, data);
}
```

No validation is performed on the data, allowing arbitrary fields to be updated (including potentially dangerous ones like `role`, `status`).

**Recommendation**

Create a DTO with validation:
```typescript
export class AdminUpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  // Explicitly exclude role from admin updates via this endpoint
}
```

---

### HIGH AUTH-004: Firebase OTP Provider Is Non-Functional

- **File**: `src/auth/otp-providers/firebase.provider.ts:42-56`
- **Category**: bug
- **Impact**: OTP verification will always fail in production if Firebase provider is selected

**Description**

Both `requestOtp` and `verifyCode` methods throw errors:
```typescript
async requestOtp(phone: string, traceId: string): Promise<void> {
  throw new Error(
    "Firebase Admin does not support requesting SMS codes. Use client SDK or ConsoleProvider.",
  );
}

async verifyCode(...): Promise<DecodedOtpToken> {
  throw new Error(
    "Firebase Admin does not support verifying plain codes. It requires a client-side ID Token.",
  );
}
```

The Firebase provider cannot work as implemented. Firebase Phone Auth requires:
1. Client-side SDK to send SMS and get an ID token
2. Server verifies the ID token (not the OTP code directly)

**Recommendation**

Either:
1. Remove FirebaseProvider and document that Firebase Phone Auth requires client-side integration
2. Implement correctly: client sends Firebase ID token, server verifies via `FirebaseService.verifyIdToken()`
3. Use a different SMS provider (Twilio, Vonage) for server-side OTP

---

### HIGH AUTH-005: Circuit Breaker onSuccess Logic Is Inverted

- **File**: `src/auth/otp.service.ts:62-72`
- **Category**: bug
- **Impact**: Circuit breaker may open/close incorrectly

**Description**

The `onSuccess` method checks if failures exceed threshold AFTER a success, which could incorrectly open the circuit:
```typescript
private onSuccess(): void {
  if (this.circuitBreaker.isOpen) {
    // ... close circuit
  } else if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
    this.circuitBreaker.isOpen = true;  // This should never happen on success
    console.error(`...`);
  }
}
```

The `else if` branch should never execute on success - it's checking the wrong condition.

**Recommendation**

Remove the incorrect branch:
```typescript
private onSuccess(): void {
  if (this.circuitBreaker.isOpen) {
    console.log("[OtpService] Circuit breaker closed after successful request");
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.halfOpenAttempts = 0;
  }
  // Reset failure count on success
  this.circuitBreaker.failures = 0;
}
```

---

### MEDIUM FINDINGS

### MEDIUM AUTH-006: Refresh Endpoint Uses Authorization Header Incorrectly

- **File**: `src/auth/auth.controller.ts:82-100`
- **Category**: bug
- **Impact**: Confusion with access/refresh token handling

**Description**

The refresh endpoint expects the refresh token in the Authorization header:
```typescript
@Post("refresh")
async refresh(@Request() req: any) {
  const authHeader = req.headers.authorization;
  // ...
  const token = authHeader.substring(7);
```

However, the gateway sends refresh tokens in cookies or body. The current implementation may not match the gateway's token handling.

**Recommendation**

Align with gateway implementation. If gateway sends refresh token in body or cookie, update this endpoint accordingly:
```typescript
@Post("refresh")
async refresh(@Body() body: RefreshDto, @Request() req: any) {
  // Accept from body or cookie
  const token = body.refreshToken || req.cookies?.refreshToken;
}
```

---

### MEDIUM AUTH-007: User Status Enum Not Enforced in Schema

- **File**: `prisma/schema.prisma:24`
- **Category**: bug
- **Impact**: Invalid status strings could be stored in database

**Description**

User status is a plain string, not an enum:
```prisma
model User {
  // ...
  status String @default("ACTIVE")
  // ...
}
```

The code uses hardcoded strings like "ACTIVE", "SUSPENDED", "PENDING_DOCUMENTS" but there's no database-level enforcement.

**Recommendation**

Add a UserStatus enum:
```prisma
enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING_DOCUMENTS
  UNDER_REVIEW
  REJECTED
  BANNED
}

model User {
  status UserStatus @default(ACTIVE)
}
```

---

### MEDIUM AUTH-008: User Role Enum Not Enforced in Schema

- **File**: `prisma/schema.prisma:22`
- **Category**: bug
- **Impact**: Invalid role strings could be stored

**Description**

Same issue as AUTH-007. Role is a plain string:
```prisma
role String
```

**Recommendation**

Add UserRole enum matching shared-types:
```prisma
enum UserRole {
  RIDER
  DRIVER
  ADMIN
  SUPPORT
}
```

---

### MEDIUM AUTH-009: NATS Responders Don't Validate Request Payloads

- **File**: `src/nats/responders/user-suspend.responder.ts:42-58`
- **Category**: security
- **Impact**: Malformed or malicious requests could cause issues

**Description**

The NATS responders accept any request structure without validation:
```typescript
await this.responder.respond<SuspendUserRequest, SuspendUserResponse>(
  'user.suspend.request',
  async (request) => {
    const { userId, suspendedBy } = request;
    // No validation that userId exists or is a valid UUID
```

**Recommendation**

Add validation:
```typescript
async (request) => {
  if (!request.userId || typeof request.userId !== 'string') {
    throw new BadRequestException('Invalid userId');
  }
  // ...
}
```

---

### MEDIUM AUTH-010: Driver Onboarding Status Not in Enum

- **File**: `prisma/schema.prisma:29-34`
- **Category**: bug
- **Impact**: Onboarding status uses enum but User.status doesn't align

**Description**

Driver has `OnboardingStatus` enum but User has plain string status. The code tries to sync them:
```typescript
if (status === "ACTIVE") onboardingStatus = "APPROVED";
else if (status === "PENDING_DOCUMENTS") onboardingStatus = "PENDING_DOCUMENTS";
```

This mapping is fragile and could get out of sync.

**Recommendation**

Either:
1. Use the same enum for both
2. Create a clear mapping function with type safety

---

### MEDIUM AUTH-011: Driver Document Upload Doesn't Validate File Count Before Processing

- **File**: `src/driver-onboarding/driver-onboarding.controller.ts:45-60`
- **Category**: edge-case
- **Impact**: User gets partial upload if file count is wrong

**Description**

Files are processed before validating count:
```typescript
for await (const part of parts) {
  if (part.type === "file") {
    const buffer = await part.toBuffer();
    processedFiles.push({...});
  }
}
if (processedFiles.length !== 3) {
  throw new BadRequestException("Exactly 3 identity images are required");
}
```

All files are read into memory before validation. This wastes resources and could be a DoS vector.

**Recommendation**

Validate file count early or limit iteration:
```typescript
const MAX_FILES = 3;
for await (const part of parts) {
  if (part.type === "file") {
    if (processedFiles.length >= MAX_FILES) break;
    // ...
  }
}
```

---

### MEDIUM AUTH-012: Update User Status Doesn't Validate Transition

- **File**: `src/auth/auth.service.ts:120-155`
- **Category**: edge-case
- **Impact**: Invalid state transitions could occur

**Description**

The `updateUserStatus` method allows any status transition without validation:
```typescript
async updateUserStatus(userId: string, status: string, ...) {
  // No validation of current status or valid transitions
  const user = await this.prisma.user.update({
    where: { id: userId },
    data: { status, updatedAt: new Date() },
  });
```

A user could go from SUSPENDED directly to APPROVED without proper review.

**Recommendation**

Implement a state machine for status transitions:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  'ACTIVE': ['SUSPENDED', 'BANNED'],
  'SUSPENDED': ['ACTIVE', 'BANNED'],
  'PENDING_DOCUMENTS': ['UNDER_REVIEW', 'REJECTED'],
  'UNDER_REVIEW': ['APPROVED', 'REJECTED'],
  // ...
};

if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
  throw new BadRequestException(`Invalid status transition: ${currentStatus} -> ${newStatus}`);
}
```

---

### LOW FINDINGS

### LOW AUTH-013: Rider Profile Controller Returns Object Instead of Throwing Exception

- **File**: `src/rider-profile/rider-profile.controller.ts:35-40`
- **Category**: code-quality
- **Impact**: Inconsistent error handling pattern

**Description**

When no image file is provided, the controller returns an error object instead of throwing an exception:
```typescript
if (!imageFile) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: "Image file is required" },
  };
}
```

Other endpoints throw `BadRequestException`. This inconsistency makes error handling harder for clients.

**Recommendation**

Use consistent error handling:
```typescript
if (!imageFile) {
  throw new BadRequestException("Image file is required");
}
```

---

### LOW AUTH-014: Driver Onboarding Service Uses `any` Type for Updates

- **File**: `src/driver-onboarding/driver-onboarding.service.ts:40-50`
- **Category**: code-quality
- **Impact**: No type safety for update data

**Description**

```typescript
const updateData: Record<string, unknown> = {};
if (dto.address !== undefined) updateData.address = dto.address;
// ...
```

Using `Record<string, unknown>` loses type information.

**Recommendation**

Use typed update objects or Prisma's generated types:
```typescript
const updateData: Prisma.UserUpdateInput = {};
```

---

### LOW AUTH-015: Console Provider Uses Hardcoded OTP Code

- **File**: `src/auth/otp-providers/console.provider.ts:20-30`
- **Category**: security
- **Impact**: Anyone can verify OTP in development if they know the code

**Description**

The console provider accepts hardcoded code "123456":
```typescript
if (code !== "123456") {
  throw new Error("Invalid or expired OTP code");
}
```

This is intentional for development but should be documented and potentially configurable.

**Recommendation**

Make the test OTP code configurable via environment variable:
```typescript
const TEST_OTP_CODE = process.env.TEST_OTP_CODE || "123456";
if (code !== TEST_OTP_CODE) {
  throw new Error("Invalid or expired OTP code");
}
```

---

### LOW AUTH-016: Prisma Schema Missing Indexes for Common Queries

- **File**: `prisma/schema.prisma`
- **Category**: performance
- **Impact**: Slow queries on large user tables

**Description**

Common query patterns lack indexes:
- `User` table queried by `role` and `status` but no indexes
- `Driver` table queried by `onboardingStatus` but no index

**Recommendation**

Add indexes for frequently queried fields:
```prisma
model User {
  // ...
  @@index([role])
  @@index([status])
  @@index([role, status])
}

model Driver {
  // ...
  @@index([onboardingStatus])
  @@index([isOnline])
}
```