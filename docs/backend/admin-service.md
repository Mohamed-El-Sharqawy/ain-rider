# Admin Service Code Review

**Workspace**: backend
**Domain**: admin-service
**Date**: 2026-04-07
**Files Reviewed**: 40+ files

## Summary

The Admin service is a comprehensive backend office for managing users, trips, vehicles, wallets, promos, notifications, complaints, and settings. It maintains a shadow copy of users from auth-service via NATS events and uses NATS request-reply for cross-service operations. The service has good audit logging and role-based access control. However, there are critical issues with hardcoded secrets, wallet operations without balance checks or transactions, extensive use of `any` types bypassing validation, and overly permissive CORS. The shadow user sync could fail silently.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/main.ts` | Issues found | 1 medium |
| `src/app.module.ts` | Clean | 0 |
| `src/auth/admin.guard.ts` | Issues found | 1 critical |
| `src/auth/jwt-auth.guard.ts` | Issues found | 1 high |
| `src/auth/roles.guard.ts` | Clean | 0 |
| `src/users/users.controller.ts` | Clean | 0 |
| `src/users/users.service.ts` | Issues found | 1 low |
| `src/wallets/wallets.controller.ts` | Clean | 0 |
| `src/wallets/wallets.service.ts` | Issues found | 2 high, 1 medium |
| `src/trips/trips.controller.ts` | Clean | 0 |
| `src/trips/trips.service.ts` | Clean | 0 |
| `src/promos/promos.controller.ts` | Clean | 0 |
| `src/promos/promos.service.ts` | Issues found | 2 medium |
| `src/settings/settings.controller.ts` | Clean | 0 |
| `src/settings/settings.service.ts` | Issues found | 1 low |
| `src/complaints/complaints.controller.ts` | Clean | 0 |
| `src/complaints/complaints.service.ts` | Issues found | 1 medium |
| `src/complaints/public-complaints.controller.ts` | Clean | 0 |
| `src/notifications/notifications.controller.ts` | Clean | 0 |
| `src/notifications/notifications.service.ts` | Issues found | 1 medium |
| `src/vehicles/vehicles.controller.ts` | Clean | 0 |
| `src/vehicles/vehicles.service.ts` | Issues found | 1 medium |
| `src/nats/admin-nats.client.ts` | Issues found | 1 medium |
| `src/shared/audit/admin-audit-logger.service.ts` | Issues found | 1 medium |
| `src/shared/internal-api/internal-api.client.ts` | Clean | 0 |
| `src/shared/nats/user-sync.service.ts` | Issues found | 1 medium |
| `prisma/schema.prisma` | Issues found | 4 medium |

---

### CRITICAL FINDINGS

### CRITICAL ADM-001: AdminGuard Has Hardcoded Secret Fallbacks

- **File**: `src/auth/admin.guard.ts:45-55`
- **Category**: security
- **Impact**: Production deployments may use weak default secrets

**Description**

The AdminGuard uses hardcoded fallbacks for both internal and JWT secrets:
```typescript
const internalSecret = this.config.get<string>('INTERNAL_SERVICE_SECRET') || 'dev-internal-secret-987654321';
// ...
const jwtSecret = this.config.get<string>('JWT_SECRET') || 'change-me-in-production';
```

Same issue as other services - fail-open instead of fail-closed.

**Recommendation**

Fail fast on missing secrets:
```typescript
const internalSecret = this.config.getOrThrow<string>('INTERNAL_SERVICE_SECRET');
const jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
```

---

### HIGH FINDINGS

### HIGH ADM-002: Wallet Debit Doesn't Check Sufficient Balance

- **File**: `src/wallets/wallets.service.ts:35-50`
- **Category**: bug
- **Impact**: Wallet balance could go negative

**Description**

The `debit` method doesn't validate that the wallet has sufficient balance:
```typescript
async debit(userId: string, amount: number, description: string, referenceId?: string) {
  const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });

  const updated = await this.prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  });
  // No check that wallet.balance >= amount
```

A wallet with 1000 IQD could be debited 5000 IQD, resulting in -4000 balance.

**Recommendation**

Add balance validation:
```typescript
async debit(userId: string, amount: number, description: string, referenceId?: string) {
  const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });

  if (wallet.balance < amount) {
    throw new BadRequestException('Insufficient wallet balance');
  }

  // ... rest of logic
}
```

---

### HIGH ADM-003: Wallet Operations Not in Transaction

- **File**: `src/wallets/wallets.service.ts:20-55`
- **Category**: bug
- **Impact**: Race conditions could cause inconsistent balances

**Description**

Both `credit` and `debit` operations involve multiple database writes without a transaction:
```typescript
async credit(userId: string, amount: number, ...) {
  const wallet = await this.prisma.wallet.upsert(...);
  const updated = await this.prisma.wallet.update(...);  // Separate write
  await this.prisma.walletTransaction.create(...);        // Separate write
  return updated;
}
```

Between the balance update and transaction record creation, another concurrent operation could read an inconsistent state.

**Recommendation**

Use Prisma transactions:
```typescript
async credit(userId: string, amount: number, description: string, referenceId?: string) {
  return this.prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: { balance: { increment: amount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        type: 'CREDIT',
        amount,
        balanceBefore: wallet.balance - amount,
        balanceAfter: wallet.balance,
        description,
        referenceId,
      },
    });

    return wallet;
  });
}
```

---

### HIGH ADM-004: JwtAuthGuard Has Same Hardcoded Fallbacks

- **File**: `src/auth/jwt-auth.guard.ts:30-35`
- **Category**: security
- **Impact**: Same as ADM-001

**Description**

```typescript
const internalSecret = this.config.get<string>('INTERNAL_SERVICE_SECRET') || 'dev-internal-secret-987654321';
const jwtSecret = this.config.get<string>('JWT_SECRET') || 'change-me-in-production';
```

Same issue as AdminGuard.

**Recommendation**

Same as ADM-001 - use `getOrThrow`.

---

### MEDIUM FINDINGS

### MEDIUM ADM-005: CORS Configuration Too Permissive

- **File**: `src/main.ts:20`
- **Category**: security
- **Impact**: Any origin can access the admin service

**Description**

```typescript
app.enableCors();
```

This allows any origin to make requests to the admin service. Unlike other services which have explicit origin whitelisting.

**Recommendation**

Use explicit CORS configuration:
```typescript
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];
app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
});
```

---

### MEDIUM ADM-006: Multiple Services Use `any` Type for Data

- **File**: `src/promos/promos.service.ts`, `src/complaints/complaints.service.ts`, `src/vehicles/vehicles.service.ts`, `src/notifications/notifications.service.ts`
- **Category**: code-quality
- **Impact**: No type safety, validation bypassed

**Description**

Multiple service methods accept `any` type:
```typescript
// promos.service.ts
create(data: any) {
  return this.prisma.promo.create({ data });
}

// complaints.service.ts
async create(data: any) {
  const complaint = await this.prisma.complaint.create({ data });
}

// vehicles.service.ts
createType(data: any) { ... }
createMake(data: any) { ... }
createModel(data: any) { ... }

// notifications.service.ts
create(data: any) { ... }
```

This bypasses DTO validation and loses type safety.

**Recommendation**

Use proper types from DTOs:
```typescript
create(data: CreatePromoDto) {
  return this.prisma.promo.create({ data });
}
```

---

### MEDIUM ADM-007: Audit Logger Swallows Errors

- **File**: `src/shared/audit/admin-audit-logger.service.ts:30-40`
- **Category**: bug
- **Impact**: Audit logs could be lost silently

**Description**

```typescript
async log(data: AuditLogData): Promise<void> {
  try {
    await this.prisma.adminAuditLog.create({ data });
  } catch (e) {
    console.error('[AdminAuditLogger] Failed to create audit log:', e);
    // Swallow error to prevent disrupting the main business logic flow
  }
}
```

While the comment explains the intent, silent failures in audit logging are problematic for compliance.

**Recommendation**

Consider a fallback mechanism:
```typescript
catch (e) {
  console.error('[AdminAuditLogger] Failed to create audit log:', e);
  // Queue for retry or write to file-based fallback
  await this.fallbackQueue.add(data);
}
```

Or at minimum, emit a metric for monitoring:
```typescript
catch (e) {
  this.metrics.increment('audit_log_failed');
  // ...
}
```

---

### MEDIUM ADM-008: User Sync Service Doesn't Handle Errors

- **File**: `src/shared/nats/user-sync.service.ts:40-100`
- **Category**: bug
- **Impact**: Shadow user data could become stale

**Description**

Each subscription catches errors but doesn't retry or alert:
```typescript
.subscribe<UserCreatedEvent['data']>(
  NATS_SUBJECTS.USER_CREATED,
  async (data) => {
    await this.prisma.userShadow.upsert({ ... });
    // No try-catch - error would break the subscription
  },
)
.catch((err) => console.error('[UserSync] USER_CREATED subscribe error:', err));
```

If the database operation fails, the error is logged but the shadow copy is not synced.

**Recommendation**

Add error handling with retry or dead-letter:
```typescript
async (data) => {
  try {
    await this.prisma.userShadow.upsert({ ... });
  } catch (err) {
    console.error(`[UserSync] Failed to sync user ${data.id}:`, err);
    // Could queue for retry or emit metric
  }
}
```

---

### MEDIUM ADM-009: NATS Client Doesn't Validate Responses

- **File**: `src/nats/admin-nats.client.ts`
- **Category**: bug
- **Impact**: Invalid responses could cause unexpected behavior

**Description**

The NATS client makes requests without validating responses:
```typescript
async suspendUser(...): Promise<SuspendUserResponse> {
  return this.requestClient.request<any, any>(
    'admin.command.suspend_user',
    { userId, reason, adminId },
    { traceId, requestedBy: adminId }
  );
}
```

The response is typed but not validated. If auth-service returns an error response, it would be returned as-is.

**Recommendation**

Add response validation:
```typescript
async suspendUser(...): Promise<SuspendUserResponse> {
  const response = await this.requestClient.request<any, any>(...);
  
  if (!response.userId || !response.newStatus) {
    throw new Error('Invalid response from auth-service');
  }
  
  return response;
}
```

---

### MEDIUM ADM-010: Promo Validate Doesn't Lock Promo for Update

- **File**: `src/promos/promos.service.ts:35-55`
- **Category**: bug
- **Impact**: Race condition could exceed usage limits

**Description**

The `validate` method checks usage limits but doesn't lock the promo:
```typescript
if (promo.currentUsageCount >= promo.totalUsageLimit) 
  return { valid: false, reason: 'Promo limit reached' };

const userUsage = await this.prisma.promoUsage.count({ where: { promoId: promo.id, userId } });
if (userUsage >= promo.maxUsagePerUser) 
  return { valid: false, reason: 'Usage limit per user reached' };
```

Between validation and actual usage, another request could use the same promo, exceeding limits.

**Recommendation**

Use atomic increment with check or lock:
```typescript
// Option 1: Atomic update with check
const updated = await this.prisma.promo.updateMany({
  where: { 
    id: promo.id,
    currentUsageCount: { lt: promo.totalUsageLimit }
  },
  data: { currentUsageCount: { increment: 1 } }
});

if (updated.count === 0) {
  return { valid: false, reason: 'Promo limit reached' };
}
```

---

### MEDIUM ADM-011: Multiple Status Fields Not Enforced as Enums

- **File**: `prisma/schema.prisma`
- **Category**: bug
- **Impact**: Invalid status strings could be stored

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

Add enums for each status type:
```prisma
enum WalletTransactionStatus {
  PENDING
  COMPLETED
  FAILED
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

### MEDIUM ADM-012: Notification Mark All As Read Could Create Many Records

- **File**: `src/notifications/notifications.service.ts:45-60`
- **Category**: performance
- **Impact**: Could create thousands of records in one operation

**Description**

```typescript
async markAllAsRead(readerId: string) {
  const unread = await this.prisma.notification.findMany({
    where: { reads: { none: { readerId } } },
    select: { id: true },
  });

  await this.prisma.notificationRead.createMany({
    data: unread.map((n) => ({ notificationId: n.id, readerId })),
    skipDuplicates: true,
  });
}
```

If a user has thousands of unread notifications, this creates thousands of records at once.

**Recommendation**

Add pagination or limit:
```typescript
const unread = await this.prisma.notification.findMany({
  where: { reads: { none: { readerId } } },
  select: { id: true },
  take: 100,  // Only mark 100 at a time
});
```

---

### LOW FINDINGS

### LOW ADM-013: Settings Service Stores All Values as Strings

- **File**: `src/settings/settings.service.ts:35-40`
- **Category**: code-quality
- **Impact**: Type coercion issues when retrieving settings

**Description**

```typescript
upsert(key: string, value: unknown, type?: string, ...) {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  // ...
}
```

All values are stored as strings, requiring parsing on retrieval. The `type` field is stored but not enforced.

**Recommendation**

Consider using the type field for validation:
```typescript
upsert(key: string, value: unknown, type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' = 'STRING', ...) {
  let valueStr: string;
  
  switch (type) {
    case 'NUMBER':
      if (typeof value !== 'number') throw new BadRequestException('Expected number');
      valueStr = value.toString();
      break;
    case 'BOOLEAN':
      valueStr = value ? 'true' : 'false';
      break;
    // ...
  }
}
```

---

### LOW ADM-014: Users Service Uses `any` for Previous User State

- **File**: `src/users/users.service.ts:40-70`
- **Category**: code-quality
- **Impact**: Type safety loss in audit logs

**Description**

```typescript
const previousUser = await this.findById(userId);
// ...
newState: { ...(previousUser as any), status: 'SUSPENDED' },
```

The `previousUser` is cast to `any` when spreading into `newState`.

**Recommendation**

Define a type for the user shadow/response:
```typescript
interface UserShadowResponse {
  id: string;
  email: string;
  status: string;
  // ...
}

newState: { ...previousUser, status: 'SUSPENDED' } as UserShadowResponse,
```

---

### LOW ADM-015: Missing Composite Indexes for Common Queries

- **File**: `prisma/schema.prisma`
- **Category**: performance
- **Impact**: Slow queries on large tables

**Description**

Missing composite indexes for:
- `PromoUsage` by `promoId` + `userId`
- `WalletTransaction` by `walletId` + `type`
- `Complaint` by `status` + `createdAt`

**Recommendation**

Add composite indexes:
```prisma
model PromoUsage {
  @@index([promoId, userId])
}

model WalletTransaction {
  @@index([walletId, type])
}

model Complaint {
  @@index([status, createdAt])
}
```

---

### LOW ADM-016: SMS Send Is Mocked

- **File**: `src/notifications/notifications.service.ts:75-80`
- **Category**: architecture
- **Impact**: SMS notifications don't actually send

**Description**

```typescript
async sendSms(phoneNumber: string, message: string) {
  console.log(`[SMS] To ${phoneNumber}: ${message}`);
  return { success: true, message: 'SMS sent successfully (mock)' };
}
```

The comment indicates this is intentional, but should be tracked.

**Recommendation**

Add a TODO or create an issue for SMS provider integration (Twilio, SNS, etc.).