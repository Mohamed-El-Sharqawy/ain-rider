# Ain Rider Code Review - Comprehensive Remediation Roadmap

**Generated**: 2026-04-07
**Scope**: Full codebase review (backend, mobile, dashboard, shared)
**Source**: 22 review documents, 274 total findings
**Phases 1-4 Status**: COMPLETED (42 findings fixed)

---

## Executive Summary

Phases 1-4 of the original roadmap have been implemented, covering critical security, high-priority stability, medium-priority UX, and low-priority technical debt items. This document replaces the original roadmap with a comprehensive plan covering **all remaining unfixed findings** organized into 5 new phases.

### Completed Work (Phases 1-4)

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | WebSocket auth, token refresh race condition, RBAC, missing gateway routes | DONE |
| Phase 2 | Auth persistence, background location, request cancellation, query dedup, error boundaries, pagination | DONE |
| Phase 3 | Form validation, console.log removal, accessibility, RTL, optimistic updates, retry logic | DONE |
| Phase 4 | Type safety, config constants, hardcoded URLs, haversine dedup, JSDoc, query key factories, WS heartbeat, skeleton states, i18n messages | DONE |

### Remaining Work Statistics

| Severity | Remaining | Percentage |
|----------|-----------|------------|
| CRITICAL | 4 | 2% |
| HIGH | 37 | 18% |
| MEDIUM | 84 | 41% |
| LOW | 79 | 39% |
| **Total** | **204** | 100% |

> Note: From 274 total findings, ~42 were fixed in Phases 1-4, ~28 are duplicates (same root cause documented in multiple review documents), yielding **204 unique remaining findings**.

---

## Deduplication Map

The following findings describe the same root cause from different review perspectives. Each group is tracked as one canonical finding:

| Canonical Finding | Duplicate Findings (cross-references only) |
|---|---|
| BGW-001 JWT hardcoded fallback | AUTH-001 (same issue in auth-service) |
| AUTH-002 Refresh token race condition | AUTH-COMPARE-001, AUTH-WS-002, DATA-001, MOB-API-003 |
| ADM-001 AdminGuard hardcoded secrets | ADM-004 (same pattern in JwtAuthGuard) |
| AUTH-WS-001 WebSocket missing auth | MOB-HK-001, DASH-PG-003, AUTH-COMPARE-007 |
| AUTH-WS-003 Background location token | MOB-HK-004 |
| AUTH-WS-004 Dashboard auth persist | DASH-PG-002, AUTH-COMPARE-003 |
| AUTH-COMPARE-004 Missing RBAC | DASH-PG-001 |
| MOB-BE-001 Missing settings routes | (Phase 1 gateway route addition; backend routes still needed) |
| MOB-BE-002 Missing support routes | (Phase 1 gateway route addition; backend routes still needed) |
| COMP-002 MapView error boundary | DASH-PG-012 (mobile side), MOB-S-003 |
| DATA-002 Mobile request cancellation | MOB-API-002 |
| DATA-003 Mobile query dedup | MOB-API-006 |
| AUTH-WS-006 Missing userId extraction | AUTH-COMPARE-009, MOB-HK-005 |
| AUTH-WS-010 Hardcoded WS URLs | MOB-HK-011, DASH-PG-010 |
| AUTH-WS-013 Console.log in auth/WS | MOB-HK-007, DASH-PG-009 |
| COMP-003 Accessibility labels | MOB-S-017 |
| COMP-012 PickupDropoffPins labels | MOB-S-015 (RTL overlap) |
| COMP-014 DataTable empty state | (fixed in Phase 4) |
| COMP-011 StatCard loading | (fixed in Phase 4) |
| COMP-013 EmptyState accessibility | (fixed in Phase 3) |
| DATA-006 Optimistic updates | (fixed in Phase 3) |
| DATA-008 Retry logic | MOB-API-004 (fixed in Phase 3) |
| MOB-S-015 Missing RTL | (partially fixed in Phase 3 for PickupDropoffPins) |

---

## Phase 5: Security Hardening (Week 1-2)

Backend security vulnerabilities and remaining authentication gaps.

### 5.1 Backend JWT/Secret Hardcoded Fallbacks (CRITICAL)

**IDs**: BGW-001, AUTH-001, ADM-001, ADM-004
**Severity**: CRITICAL
**Effort**: 1 day

**Files**:
- `backend/apps/elysia/api-gateway/src/modules/auth/guard.ts`
- `backend/apps/nest/auth-service/src/auth/auth.module.ts`
- `backend/apps/nest/auth-service/src/auth/jwt.strategy.ts`
- `backend/apps/nest/admin-service/src/auth/admin.guard.ts`
- `backend/apps/nest/admin-service/src/auth/jwt-auth.guard.ts`

**Tasks**:
1. Remove `"change-me-in-production"` fallback from API gateway guard; fail fast on startup
2. Replace `config.get()` with `config.getOrThrow()` for JWT_SECRET in auth-service
3. Replace hardcoded fallbacks in AdminGuard and JwtAuthGuard with `getOrThrow()`
4. Add startup validation that all required secrets are present

---

### 5.2 Missing Internal Auth on Backend Services (HIGH)

**IDs**: LOC-001, MAT-001, PAY-002, WS-001
**Severity**: HIGH
**Effort**: 2-3 days

**Files**:
- `backend/apps/elysia/location-service/src/modules/location/index.ts`
- `backend/apps/elysia/match-service/src/modules/match/index.ts`
- `backend/apps/nest/payment-service/src/payments/payments.controller.ts`
- `backend/apps/elysia/websocket-server/src/modules/realtime/index.ts`

**Tasks**:
1. Add `internalAuthGuard` to all location-service endpoints
2. Add `internalAuthGuard` to match-service endpoints; validate driver identity on `/respond`
3. Add `@UseGuards(InternalAuthGuard)` to payment-service controller
4. Add JWT verification on WebSocket server connection open (validate subscription matches user)
5. Test all services reject unauthenticated requests

---

### 5.3 Rate Limiting & Input Validation on Gateway (HIGH)

**IDs**: BGW-003, BGW-004, BGW-005, BGW-006
**Severity**: HIGH
**Effort**: 2 days

**Files**:
- `backend/apps/elysia/api-gateway/src/index.ts`
- `backend/apps/elysia/api-gateway/src/modules/metrics/proxy.ts`
- `backend/apps/elysia/api-gateway/src/modules/admin/index.ts`
- `backend/apps/elysia/api-gateway/src/modules/auth/index.ts`

**Tasks**:
1. Fix rate limiting IP spoofing: trust only rightmost IP in `X-Forwarded-For`, or use `CF-Connecting-IP`
2. Add `authGuard` to metrics endpoints; optionally restrict to admin role
3. Add explicit role check (`ADMIN`/`SUPPORT`) on admin proxy wildcard route
4. Validate actual `rawBody.byteLength` for multipart uploads instead of trusting `Content-Length`

---

### 5.4 WebSocket Server Hardening (HIGH)

**IDs**: WS-001, WS-002, WS-003, WS-004, WS-005
**Severity**: HIGH
**Effort**: 3 days

**Files**:
- `backend/apps/elysia/websocket-server/src/modules/realtime/index.ts`
- `backend/apps/elysia/websocket-server/src/shared/connections.ts`

**Tasks**:
1. Use Redis Pub/Sub for cross-replica message fan-out (replace in-memory connection store)
2. Call `registerAdmin` when admin client subscribes to admin channel (auto-register from JWT role)
3. Add per-connection rate limiting (e.g., 100 messages/minute)
4. Add message parsing validation (check `type`, `channel`, `id` exist; wrap in try-catch)

---

### 5.5 Auth Service Vulnerabilities (HIGH)

**IDs**: AUTH-002, AUTH-003, AUTH-004, AUTH-005
**Severity**: HIGH
**Effort**: 3 days

**Files**:
- `backend/apps/nest/auth-service/src/auth/auth.service.ts`
- `backend/apps/nest/auth-service/src/auth/admin.controller.ts`
- `backend/apps/nest/auth-service/src/auth/otp-providers/firebase.provider.ts`
- `backend/apps/nest/auth-service/src/auth/otp.service.ts`

**Tasks**:
1. Add database-level locking or `$transaction` with `SELECT FOR UPDATE` around refresh operations
2. Create `AdminUpdateUserDto` with class-validator; exclude dangerous fields like `role`
3. Fix or remove Firebase OTP provider (currently non-functional)
4. Fix circuit breaker `onSuccess` logic (inverted branch opens circuit on success)

---

### 5.6 Trip Service Race Conditions & State Validation (HIGH)

**IDs**: TRIP-001, TRIP-002
**Severity**: HIGH
**Effort**: 2 days

**Files**:
- `backend/apps/nest/trip-service/src/trips/trips.service.ts`

**Tasks**:
1. Implement `VALID_TRANSITIONS` map per TripStatus and validate before status updates
2. Replace check-then-update pattern with atomic `updateMany` + `where: { id, status: { in: [...] } }`

---

### 5.7 Payment Service Security (HIGH)

**IDs**: PAY-001, PAY-002, PAY-003, PAY-004
**Severity**: HIGH
**Effort**: 2 days

**Files**:
- `backend/apps/nest/payment-service/src/payments/payments.service.ts`
- `backend/apps/nest/payment-service/src/payments/payments.controller.ts`
- `backend/apps/nest/payment-service/src/consumers/trip-completed.consumer.ts`

**Tasks**:
1. Add upsert or `findUnique` check before creating payment for a trip (prevent double-charge)
2. Add auth guard to payment controller
3. Validate refund amount doesn't exceed payment total before creating
4. Implement idempotency in trip-completed consumer

---

### 5.8 Admin Service Wallet & Auth (HIGH)

**IDs**: ADM-002, ADM-003
**Severity**: HIGH
**Effort**: 1 day

**Files**:
- `backend/apps/nest/admin-service/src/wallets/wallets.service.ts`

**Tasks**:
1. Add sufficient balance check before wallet debit
2. Wrap credit/debit operations in `$transaction`

---

### 5.9 Location & Match Service Security (HIGH)

**IDs**: LOC-002, LOC-003, MAT-002, MAT-003, MAT-004, MAT-005
**Severity**: HIGH
**Effort**: 3 days

**Files**:
- `backend/apps/elysia/location-service/src/modules/location/service.ts`
- `backend/apps/elysia/match-service/src/modules/match/service.ts`
- `backend/apps/elysia/match-service/src/index.ts`

**Tasks**:
1. Use H3 `gridDisk(k=2)` for nearby drivers instead of exact cell match
2. Use Lua script for atomic read-previous-update-current in Redis location updates
3. Remove duplicate `/driver/respond` endpoint definition
4. Use Redis MULTI/EXEC for atomic driver registration
5. Add explicit deadline check (`Date.now() >= searchDeadline`) before each `continue` in match loop
6. Track background match promises in a `Set<Promise>` for cleanup on shutdown

---

### 5.10 Mobile Client Auth Gaps (HIGH)

**IDs**: MOB-S-002, MOB-S-005, MOB-NA-001, MOB-NA-002, MOB-ST-002
**Severity**: HIGH
**Effort**: 3 days

**Files**:
- `mobile/app/_layout.tsx`
- `mobile/app/(driver)/(tabs)/home.tsx`
- `mobile/stores/onboarding.store.ts`

**Tasks**:
1. Fix driver home WebSocket cleanup: use mounted ref pattern, unconditional cleanup
2. Consolidate root layout routing into a single state machine (`AuthRouteState`)
3. Add `safeRedirect()` with debounce to prevent infinite redirect loops
4. Deduplicate concurrent `fetchOnboardingStatus` calls in onboarding store

---

### 5.11 Mobile API Client Gaps (HIGH)

**IDs**: MOB-API-001, MOB-API-002, MOB-S-001, MOB-HK-002, MOB-HK-003
**Severity**: HIGH
**Effort**: 2 days

**Files**:
- `mobile/lib/api/client.ts`
- `mobile/app/(rider)/trip/[id].tsx`
- `mobile/hooks/useLocation.ts`
- `mobile/hooks/useTrip.ts`

**Tasks**:
1. Add 30-second `AbortController` timeout to every fetch call
2. Expose `createAbortController()` on client; accept `AbortSignal` in request methods
3. Fix duplicate WebSocket listeners in rider trip screen (use one pattern only)
4. Add mounted tracking to `useLocation` hook; guard state updates
5. Clean up WebSocket subscription in `useTrip` on unmount

---

### 5.12 Dashboard Auth Gaps (HIGH)

**IDs**: DASH-BE-001
**Severity**: HIGH
**Effort**: 2 days

**Files**:
- `dashboard/src/pages/*/services/api.ts`

**Tasks**:
1. Verify admin-service has routes for all 44 proxied endpoints
2. Test each dashboard page against actual backend responses
3. Document any endpoints that are missing or have mismatched contracts

---

## Phase 6: Data Integrity & Backend Robustness (Week 3-4)

Schema enforcement, state machines, error handling, and database optimization.

### 6.1 Prisma Schema Enum Enforcement (MEDIUM)

**IDs**: AUTH-007, AUTH-008, TRIP-005, TRIP-006, PAY-005, PAY-006, ADM-011, AUTH-DB-001, TRIP-DB-001, PAY-DB-001, ADMIN-DB-002
**Severity**: MEDIUM
**Effort**: 3 days

**Files**:
- `backend/apps/nest/auth-service/prisma/schema.prisma`
- `backend/apps/nest/trip-service/prisma/schema.prisma`
- `backend/apps/nest/payment-service/prisma/schema.prisma`
- `backend/apps/nest/admin-service/prisma/schema.prisma`

**Tasks**:
1. Add `UserRole` enum (RIDER, DRIVER, ADMIN, SUPPORT)
2. Add `UserStatus` enum (ACTIVE, SUSPENDED, PENDING_DOCUMENTS)
3. Add `TripStatus` enum (REQUESTED, ASSIGNED, MATCHED, IN_PROGRESS, COMPLETED, CANCELLED)
4. Add `PaymentStatus` enum (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED)
5. Add `RefundStatus` enum (PENDING, APPROVED, PROCESSED, REJECTED)
6. Add `WalletTransactionStatus`, `PromoStatus`, `PromoType`, `NotificationStatus`, `SOSStatus`, `ComplaintStatus`, `VehicleStatus` enums
7. Update all service code to use enum types instead of string literals

---

### 6.2 Database Indexes (MEDIUM/LOW)

**IDs**: AUTH-016, TRIP-012, PAY-010, ADM-015, LOC-009, AUTH-DB-002, AUTH-DB-003, AUTH-DB-005, TRIP-DB-002, TRIP-DB-003, TRIP-DB-004, PAY-DB-002, PAY-DB-003, ADMIN-DB-003, ADMIN-DB-004, ADMIN-DB-005, ADMIN-DB-007
**Severity**: MEDIUM/LOW
**Effort**: 2 days

**Files**: All `prisma/schema.prisma` files

**Tasks**:
1. Auth: `@@index([role])`, `@@index([status])`, `@@index([role, status])`, `@@index([onboardingStatus])`, `@@index([make, model])`, `@@index([family])` on RefreshToken
2. Trip: `@@index([riderId, status])`, `@@index([driverId, status])`, `@@index([status, requestedAt])`, `@@index([status, createdAt])` on SOS
3. Payment: `@@index([status])` on Refund, `@@unique([paymentId, amount])`, `@@index([createdAt])`, `@@index([status, createdAt])`
4. Admin: `@@index([promoId, userId])`, `@@index([walletId, type])`, `@@index([status, createdAt])`, `@@index([type])` on WalletTransaction, `@@index([scheduledAt])` on Booking
5. Location: composite index on `(h3_index, recorded_at DESC)`

---

### 6.3 State Machine Validation (MEDIUM)

**IDs**: AUTH-010, AUTH-012, TRIP-003, TRIP-007, MOB-ST-009
**Severity**: MEDIUM
**Effort**: 2 days

**Files**:
- `backend/apps/nest/auth-service/src/auth/auth.service.ts`
- `backend/apps/nest/trip-service/src/trips/trips.service.ts`
- `mobile/stores/trip.store.ts`

**Tasks**:
1. Implement `VALID_TRANSITIONS` map for user status in auth-service
2. Validate trip status transitions on backend (throw for COMPLETED/CANCELLED from invalid states)
3. Use `x-user-id` from gateway JWT instead of client-supplied `x-driver-id` header
4. Add `VALID_TRANSITIONS` map to mobile trip store; `console.warn` on invalid

---

### 6.4 NATS Consumer & Responder Robustness (MEDIUM)

**IDs**: AUTH-009, TRIP-008, TRIP-009, ADM-008, ADM-009, PKG-NATS-001, PKG-NATS-002
**Severity**: MEDIUM
**Effort**: 3 days

**Files**:
- `backend/apps/nest/auth-service/src/nats/responders/*.ts`
- `backend/apps/nest/trip-service/src/consumers/*.ts`
- `backend/apps/nest/trip-service/src/nats/responders/*.ts`
- `backend/apps/nest/admin-service/src/shared/nats/user-sync.service.ts`
- `backend/packages/nats-client/src/consumer.ts`
- `backend/packages/nats-client/src/jetstream/consumer.ts`

**Tasks**:
1. Add field existence and type validation in all NATS responder handlers
2. Add try-catch in trip-matched consumer to prevent crashes
3. Add error handling in user-sync service with retry or dead-letter
4. Add response validation in admin NATS client
5. Deprecate legacy consumer; migrate all services to `JetStreamConsumer`
6. Don't auto-create streams; require explicit setup with all subjects

---

### 6.5 Backend Error Handling & Consistency (MEDIUM/LOW)

**IDs**: BGW-007, BGW-008, BGW-009, BGW-010, BGW-011, BGW-014, AUTH-006, AUTH-011, AUTH-013, TRIP-004, TRIP-010, TRIP-011, TRIP-013, TRIP-014, PAY-007, PAY-008, PAY-009, PAY-011, PAY-012, ADM-007, ADM-010, ADM-013, ADM-016, LOC-004, LOC-005, LOC-006, LOC-007, LOC-008, LOC-010, MAT-008, MAT-009, MAT-010, MAT-012, MAT-013, WS-006, WS-008
**Severity**: MEDIUM/LOW
**Effort**: 5 days

**Files**: Multiple backend files across all services

**Tasks**:
1. Use `t.Union([t.Literal(...)])` for trip status in gateway model instead of `t.String()`
2. Add `isNaN()` validation after `parseFloat` in location and match query params
3. Add body validation schema to support module
4. Review cookie SameSite settings for mobile vs dashboard
5. Extract reusable `handleProxyError(res, set)` helper for proxy routes
6. Align auth refresh endpoint with gateway (accept token from body/cookie)
7. Validate file count early in driver document upload
8. Fetch fare rates from settings/env vars instead of hardcoding
9. Require at least one filter in trip listing or throw `BadRequestException`
10. Fetch trip before update to capture correct previous status
11. Fail fast if `OSRM_URL` not set; don't silently use `localhost:5000`
12. Add `ASSIGNED` to TripStatus enum or remove intermediate status
13. Validate refund amount against payment amount; document constraint in DTO
14. Check payment exists and is PENDING before cash confirmation
15. Fetch existing payment amount before update for correct `previousAmount`
16. Make currency configurable in payment service
17. Define `CashGatewayResponse` interface instead of `any`
18. Add fallback mechanism to audit logger (queue retry, file-based fallback)
19. Use atomic `updateMany` in promo validate to prevent race condition
20. Add type-based validation in settings service using `type` field
21. Fail fast if `DATABASE_URL` not set in location service
22. Use `ON CONFLICT DO NOTHING` for idempotent location updates
23. Add `MAX_HISTORY_DAYS = 30` limit on history queries
24. Make Redis TTL configurable in location service
25. Add UUID format validation on driverId in location model
26. Use Redis for real-time nearby queries; TimescaleDB only for historical
27. Validate authenticated driver matches `driverId` in match respond
28. Use structured JSON logging to stdout instead of file writes
29. Make match search parameters configurable via env vars
30. Validate coordinate bounds in manual match endpoint
31. Clean H3 cell on driver unregister
32. Whitelist valid WebSocket channels
33. Track and clean driver watchers on WebSocket disconnect

---

### 6.6 Gateway & Admin Input Validation (MEDIUM)

**IDs**: BGW-012, BGW-013, ADM-005, ADM-006, ADM-012, ADM-014, PKG-REDIS-001, PKG-REDIS-002, PKG-API-001, PKG-API-002, PKG-CROSS-001, PKG-CROSS-002
**Severity**: MEDIUM
**Effort**: 3 days

**Files**:
- `backend/apps/elysia/api-gateway/src/shared/redis.ts`
- `backend/apps/elysia/api-gateway/src/index.ts`
- `backend/apps/nest/admin-service/src/main.ts`
- `backend/packages/redis-client/src/cluster.ts`
- `backend/packages/redis-client/src/cache.ts`
- `backend/packages/internal-api/src/fetch-internal.ts`

**Tasks**:
1. Remove unused `redisCluster`/`cache` exports or implement caching
2. Use centralized `traceMiddleware` from shared; remove inline implementation
3. Restrict CORS to explicit `allowedOrigins` from env var
4. Replace `any` types in admin services with proper DTOs
5. Add pagination limit to notification "mark all as read"
6. Define `UserShadowResponse` interface instead of `any` cast
7. Make Redis NAT mapping configurable via env var
8. Throw `CacheError` instead of returning null on cache failure
9. Add automatic `x-internal-secret` header to internal API client
10. Add retry with exponential backoff to internal API client
11. Standardize on one Redis client library (prefer `ioredis`)
12. Create `@ain-rider/config` shared package for env var loading/validation

---

## Phase 7: Mobile Robustness & UX (Week 5-6)

Mobile-specific error handling, validation, state management, and UX improvements.

### 7.1 Mobile Input Validation (MEDIUM)

**IDs**: MOB-S-006, MOB-S-007, MOB-S-008, MOB-S-012, MOB-S-013, MOB-API-008, MOB-API-010, MOB-API-011
**Severity**: MEDIUM
**Effort**: 2 days

**Files**:
- `mobile/app/(auth)/phone.tsx`
- `mobile/app/(auth)/basic-info.tsx`
- `mobile/app/(auth)/verify-otp.tsx`
- `mobile/app/(auth)/documents.tsx`
- `mobile/app/(auth)/driver-documents.tsx`
- `mobile/app/(auth)/driver-profile-extra.tsx`
- `mobile/lib/api/trip.api.ts`
- `mobile/lib/api/support.api.ts`
- `mobile/lib/api/settings.api.ts`

**Tasks**:
1. Add `isValidPhone()` validation (strip non-digits, check 9-15 length)
2. Add `isValidEmail()` regex check in basic-info
3. Track OTP expiry with timestamp; disable verify button when expired
4. Add file size validation for document uploads (max 5MB)
5. Add `isValidDate()` for driver profile extra (YYYY-MM-DD, valid, past)
6. Add pagination parameters to trip API
7. Add pagination to support/complaints API
8. Add type guard for settings JSON parse with proper error logging

---

### 7.2 Mobile Store Improvements (MEDIUM)

**IDs**: MOB-ST-001, MOB-ST-003, MOB-ST-004, MOB-ST-005, MOB-ST-006, MOB-ST-007, MOB-ST-008
**Severity**: MEDIUM
**Effort**: 2 days

**Files**:
- `mobile/stores/auth.store.ts`
- `mobile/stores/trip.store.ts`
- `mobile/stores/driver.store.ts`
- `mobile/stores/onboarding.store.ts`
- `mobile/stores/location.store.ts`

**Tasks**:
1. Add `isLoading` and `error` state to auth store async operations
2. Persist trip store with `AsyncStorage` (activeTrip, phase, driver only)
3. Add `error: string | null` and `clearError()` to auth store
4. Persist driver `isOnline` state; sync with backend on app start
5. Create memoized selectors for trip store derived state
6. Define proper `OnboardingStatusResponse` interface; remove `any` cast
7. Add typed error state to location store

---

### 7.3 Mobile Navigation & UX (MEDIUM)

**IDs**: MOB-S-009, MOB-S-010, MOB-S-011, MOB-S-014, MOB-NA-004, MOB-NA-005, MOB-NA-006, MOB-NA-003
**Severity**: MEDIUM
**Effort**: 3 days

**Files**:
- `mobile/app/(rider)/(tabs)/activity.tsx`
- `mobile/app/(rider)/search.tsx`
- `mobile/app/(driver)/trip/[id].tsx`
- `mobile/app/_layout.tsx`
- `mobile/app/offline.tsx`

**Tasks**:
1. Add pull-to-refresh with `RefreshControl` to activity screen
2. Implement cursor-based pagination in activity screen
3. Fix search debounce cleanup: use refs for timer + `AbortController`
4. Add proper error state for driver trip route recalculation
5. Check backend driver status before forcing offline on app start
6. Request notification permissions with iOS-specific options
7. Fix offline screen retry to check connectivity before navigating
8. Store deep links in `AsyncStorage` when unauthenticated; navigate after auth

---

### 7.4 Mobile Hooks & Services (MEDIUM)

**IDs**: MOB-HK-005, MOB-HK-006, MOB-HK-008, MOB-HK-009, MOB-HK-010, MOB-HK-011
**Severity**: MEDIUM
**Effort**: 2 days

**Files**:
- `mobile/hooks/useAuthCheck.ts`
- `mobile/hooks/useNearbyDrivers.ts`
- `mobile/hooks/useWebSocket.ts`
- `mobile/services/location.service.ts`
- `mobile/services/map/osm.provider.ts`

**Tasks**:
1. Extract `userId` from JWT in `useAuthCheck` and pass to `setAuth()`
2. Add `isLoading` and `error` states to `useNearbyDrivers` hook
3. Throw error in location service instead of silently falling back to Baghdad
4. Add shared `fetchWithTimeout()` helper to OSM provider (default 5s)
5. Replace `useRef(false)` with `useState(false)` for `isConnected` in `useWebSocket`
6. (Hardcoded WS URLs centralized in Phase 4 — verify all consumers updated)

---

### 7.5 Dashboard Remaining Issues (MEDIUM)

**IDs**: DASH-PG-004, DASH-PG-008, DASH-PG-010, DASH-PG-011, DASH-BE-002, DASH-BE-003, DATA-004, DATA-005, DATA-007, DATA-009, DATA-013
**Severity**: MEDIUM
**Effort**: 3 days

**Files**:
- `dashboard/src/pages/*/services/queries.ts`
- `dashboard/src/hooks/useTokenRefresh.ts`
- `dashboard/src/hooks/useWebSocket.ts`
- `dashboard/src/pages/notifications/NotificationsPage.tsx`
- `dashboard/src/pages/users/services/api.ts`
- `dashboard/src/api/client.ts`

**Tasks**:
1. (Pagination queries — added in Phase 2; verify UI connected for all pages)
2. Dispatch `auth:unauthorized` event in token refresh catch block
3. Make `VITE_WS_URL` required or warn when not set
4. Fix notifications page tab switching: use separate state arrays per tab
5. Standardize mixed routing pattern (direct auth vs admin proxy)
6. Implement pagination UI for trips and users pages
7. Replace manual polling in mobile with TanStack Query `refetchInterval`
8. Add `staleTime: 30_000` and `gcTime: 5 * 60_000` to dashboard queries
9. Use `@lukemorales/query-key-factory` for typed query keys
10. Localize dashboard error messages with i18n

---

### 7.6 Shared Packages Type Safety (MEDIUM)

**IDs**: PKG-TYPES-001, PKG-TYPES-002, PKG-NATS-003, PKG-NATS-004, PKG-CROSS-002
**Severity**: MEDIUM
**Effort**: 2 days

**Files**:
- `backend/packages/shared-types/src/events.types.ts`
- `backend/packages/nats-client/src/idempotency/idempotency.service.ts`

**Tasks**:
1. Use discriminated unions for event payloads (required fields per state)
2. Add Zod schemas for runtime validation of NATS events
3. Create `RedisClientLike` interface for idempotency service
4. Add Prometheus counter for idempotency cache hits/misses
5. Create `@ain-rider/config` package with env var loading/validation

---

### 7.7 Cross-Platform Auth Consistency (MEDIUM)

**IDs**: AUTH-COMPARE-002, AUTH-COMPARE-005, AUTH-COMPARE-006, AUTH-WS-005, AUTH-WS-007, AUTH-WS-008, AUTH-WS-009
**Severity**: MEDIUM
**Effort**: 2 days

**Files**:
- `mobile/lib/api/auth.api.ts`
- `dashboard/src/pages/login/services/api.ts`
- `mobile/services/websocket.service.ts`
- `dashboard/src/hooks/useWebSocket.ts`
- `dashboard/src/hooks/useTokenRefresh.ts`

**Tasks**:
1. Document token delivery pattern: mobile=body, dashboard=cookie
2. Mobile should call logout endpoint to invalidate server-side sessions
3. (Token expiry warning — reverted per user decision; skip)
4. Re-send fresh auth token on every WebSocket `onopen` (including reconnects)
5. Add `subscriptionsRef` in dashboard WS hook; re-subscribe all on reconnect
6. On WS auth failure (close codes 4001/4002), clear auth and redirect to login

---

## Phase 8: Low Priority Backend & Schema (Week 7-8)

Low-severity backend items, schema improvements, and shared package cleanup.

### 8.1 Prisma Schema Cleanup (LOW)

**IDs**: AUTH-014, AUTH-015, AUTH-DB-004, PAY-012, ADM-014, ADMIN-DB-005, ADMIN-DB-006
**Severity**: LOW
**Effort**: 2 days

**Files**: All `prisma/schema.prisma` files

**Tasks**:
1. Use `Prisma.UserUpdateInput` instead of `Record<string, unknown>` in driver onboarding
2. Make test OTP code configurable via `process.env.TEST_OTP_CODE`
3. Add `deletedAt DateTime?` and `deletedBy String?` soft-delete fields
4. Define `CashGatewayResponse` interface with typed fields
5. Add `syncStatus` and `syncError` fields to UserShadow model
6. Add `SettingType` enum (STRING, NUMBER, BOOLEAN, JSON) to settings

---

### 8.2 Schema Documentation & Naming (CROSS-SCHEMA)

**IDs**: SCHEMA-CROSS-001, SCHEMA-CROSS-002, SCHEMA-CROSS-003, TRIP-DB-002, AUTH-DB-003
**Severity**: LOW
**Effort**: 2 days

**Files**: All `prisma/schema.prisma` files

**Tasks**:
1. Establish naming conventions: `latitude/longitude` consistent, `createdAt`, `{entity}Id` for FKs
2. Add `///` documentation comments on models and key fields
3. Document migration strategy: backward-compatible changes, deprecation periods, coordination
4. Document if duplicated driver info in Trip is intentional for historical accuracy

---

### 8.3 WebSocket Server Cleanup (LOW)

**IDs**: WS-007, WS-009, WS-010, WS-011
**Severity**: LOW
**Effort**: 1 day

**Files**:
- `backend/apps/elysia/websocket-server/src/modules/realtime/index.ts`
- `backend/apps/elysia/websocket-server/src/index.ts`

**Tasks**:
1. Add server-side heartbeat with periodic ping and timeout detection
2. Set 30s timeout to close connections that don't subscribe
3. Add SIGTERM handler for graceful shutdown
4. Verify all consumer classes are properly exported

---

### 8.4 Shared Packages Polish (LOW)

**IDs**: PKG-API-001, PKG-API-002, PKG-NATS-003, PKG-NATS-004
**Severity**: LOW
**Effort**: 1 day

**Files**:
- `backend/packages/internal-api/src/fetch-internal.ts`
- `backend/packages/nats-client/src/idempotency/idempotency.service.ts`

**Tasks**:
1. Add `x-internal-secret` header support to internal API client
2. Add retry with exponential backoff for transient failures
3. Create `RedisClientLike` interface for idempotency service
4. Add idempotency hit/miss metrics

---

## Phase 9: Low Priority Mobile & Dashboard (Week 9+)

UX polish, developer experience, and low-severity improvements.

### 9.1 Mobile UX Polish (LOW)

**IDs**: MOB-S-016, MOB-S-019, MOB-S-020, MOB-ST-012
**Severity**: LOW
**Effort**: 2 days

**Files**:
- `mobile/app/(auth)/pending-approval.tsx`
- `mobile/app/(rider)/(tabs)/home.tsx`
- `mobile/app/(rider)/confirm.tsx`
- `mobile/stores/driver.store.ts`

**Tasks**:
1. Create reusable `LoadingSpinner` component with consistent styling
2. Remove or make dynamic the static "Tomorrow" estimate in pending approval
3. Add "No drivers nearby" overlay when drivers array is empty
4. Add `estimatedDuration`, `estimatedFare`, `riderName`, `riderPhone` to driver store

---

### 9.2 Mobile Accessibility & RTL (LOW)

**IDs**: MOB-S-015, MOB-S-017, MOB-S-018
**Severity**: LOW
**Effort**: 2 days

**Files**: Multiple mobile screen files

**Tasks**:
1. Replace physical direction classes (`ml-`, `mr-`, `left-`, `right-`) with logical properties (`ms-`, `me-`, `start-`, `end-`)
2. Add `accessible`, `accessibilityLabel`, `accessibilityRole` to all TouchableOpacity wrappers
3. Remove remaining `console.log` statements or wrap in `if (__DEV__)`

---

### 9.3 Mobile Store & Hook Polish (LOW)

**IDs**: MOB-ST-010, MOB-ST-011, MOB-ST-013, MOB-HK-012, MOB-HK-013, MOB-HK-014, MOB-HK-015, MOB-HK-016
**Severity**: LOW
**Effort**: 1 day

**Files**:
- `mobile/stores/*.ts`
- `mobile/hooks/*.ts`
- `mobile/services/map/index.ts`

**Tasks**:
1. Wrap each store's `create()` with Zustand `devtools` middleware
2. Remove `[OnboardingDebug]` console.log or wrap in `__DEV__`
3. Add `tokenExpiry`, `isRefreshing` state to auth store
4. Remove `[AuthDebug]` console.log or wrap in `__DEV__`
5. Make `useNearbyDrivers` polling interval configurable via options
6. Remove duplicate BAGHDAD constant in location service
7. Increase notification rate limit from 2s to 5s in WebSocket service
8. Add validation for invalid map provider fallback

---

### 9.4 Mobile API Polish (LOW)

**IDs**: MOB-API-009, MOB-API-012, MOB-API-013, MOB-API-014, MOB-API-015
**Severity**: LOW
**Effort**: 1 day

**Files**:
- `mobile/lib/api/client.ts`
- `mobile/lib/api/match.api.ts`
- `mobile/lib/api/auth.ts`
- `mobile/lib/api/driver.ts`

**Tasks**:
1. Type match API responses with proper interfaces
2. Add `validateUrl()` helper for base URL validation
3. Add response validation with runtime checks
4. Add `delete<T>` method to API client
5. Remove duplicate `getOnboardingStatus` from auth.ts

---

### 9.5 Dashboard UX Polish (LOW)

**IDs**: DASH-PG-013, DASH-PG-014, DASH-PG-015, DASH-PG-016, DASH-BE-004, DASH-BE-005
**Severity**: LOW
**Effort**: 2 days

**Files**:
- `dashboard/src/pages/profile/ProfilePage.tsx`
- `dashboard/src/pages/dashboard/DashboardPage.tsx`
- `dashboard/src/pages/complaints/components/ComplaintDetailModal.tsx`
- `dashboard/src/pages/profile/services/api.ts`

**Tasks**:
1. Replace generic image type check with explicit `ALLOWED_TYPES` array
2. Add loading text to mutation buttons ("Updating...", "Sending...")
3. Show combined error state with retry on dashboard page when queries fail
4. Add `dir="ltr"` to LTR input fields (email, phone)
5. Add code comment explaining MinIO presigned URL upload pattern
6. Define `ApiError` interface for dashboard API calls

---

### 9.6 Mobile Navigation Polish (LOW)

**IDs**: MOB-NA-007, MOB-NA-008, MOB-NA-009, MOB-NA-010
**Severity**: LOW
**Effort**: 1 day

**Files**:
- `mobile/app/_layout.tsx`
- `mobile/app/(rider)/_layout.tsx`
- `mobile/app/(driver)/_layout.tsx`
- `mobile/app/(auth)/login.tsx`
- `mobile/app/(auth)/verify-otp.tsx`

**Tasks**:
1. Remove `[LayoutDebug]` console.log statements
2. Standardize tab navigator configuration (icons, labels, badges)
3. Move `SplashScreen.hideAsync()` to after route state determination
4. Add client-side rate limiting for auth attempts (lock out after 5 failures for 60s)

---

### 9.7 Shared Components Polish (LOW)

**IDs**: COMP-004, COMP-005, COMP-006, COMP-008, COMP-009, COMP-010
**Severity**: LOW
**Effort**: 2 days

**Files**:
- `mobile/components/map/DriverMarker.tsx`
- `mobile/components/map/MapView.tsx`
- `mobile/components/map/RoutePolyline.tsx`
- `mobile/components/map/LocationMarker.tsx`
- `mobile/components/RejectionBanner.tsx`

**Tasks**:
1. Document that `DriverMarker` parent must use `driver.id` as React key
2. Replace NativeWind complex opacity modifiers with `StyleSheet.create()` in RejectionBanner
3. Create shared `DEFAULT_LOCATION` constant in config (replace duplicate BAGHDAD)
4. Add `isValidCoordinate()` check in RoutePolyline; return null if < 2 valid coords
5. (Camera ref typed in Phase 4 — verify `Camera` type import correct)
6. Add `AppState` listener to stop/start LocationMarker animation on background/active

---

### 9.8 Data Fetching Polish (LOW)

**IDs**: DATA-010, DATA-011, DATA-012, AUTH-WS-010, AUTH-WS-011, AUTH-WS-012, AUTH-COMPARE-008, AUTH-COMPARE-009
**Severity**: LOW
**Effort**: 2 days

**Files**:
- `mobile/lib/api/*.ts`
- `dashboard/src/pages/*/services/queries.ts`
- `mobile/hooks/useWebSocket.ts`

**Tasks**:
1. Add simple in-memory response cache with 30s TTL for mobile GET requests
2. Use `select` option in dashboard queries to extract only needed fields
3. Add `AppState` listener to invalidate critical mobile queries on app resume
4. (WS URL centralization done in Phase 4 — verify all consumers)
5. Replace `useRef(false)` with `useState(false)` for WS connection state
6. Add client-side rate limiting for auth attempts on both platforms
7. Standardize error handling patterns across mobile and dashboard
8. Extract userId from JWT in mobile auth check

---

## Implementation Guidelines

### Testing Requirements

Each fix should include:
1. Unit tests for new logic
2. Integration tests for API changes
3. Manual testing checklist
4. Regression test for affected features

### Code Review Checklist

- [ ] No new console.log statements
- [ ] Error handling for all async operations
- [ ] Loading states for all mutations
- [ ] Accessibility labels for UI components
- [ ] Type safety (no `any` without justification)
- [ ] Documentation for complex logic
- [ ] No hardcoded secrets or fallbacks

### Deployment Strategy

1. **Phase 5**: Deploy to staging, thorough security testing, penetration test
2. **Phase 6**: Deploy to staging, database migration testing, data integrity checks
3. **Phase 7**: Deploy to staging, UX testing, mobile device testing
4. **Phase 8**: Deploy with regular releases, schema migrations
5. **Phase 9**: Deploy incrementally with regular releases

---

## Metrics for Success

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Critical findings | 4 | 0 | Week 2 |
| High findings | 37 | 0 | Week 4 |
| Medium findings | 84 | 0 | Week 6 |
| Low findings | 79 | 0 | Week 9+ |
| Test coverage | ~40% | 70% | Week 6 |
| TypeScript strict errors | Unknown | 0 | Week 4 |
| Console.log count | 15+ | 0 | Week 5 |

---

## Risk Assessment

### High Risk Areas (Phase 5)

1. **JWT/Secret fallbacks**: Services start with insecure defaults in production
2. **Missing internal auth**: Any service on the internal network can call any endpoint
3. **WebSocket unauthenticated**: Anyone can connect and subscribe to events
4. **Payment double-charge**: Race conditions can create duplicate payments

### Medium Risk Areas (Phase 6-7)

1. **Schema string enums**: Invalid data can be silently stored
2. **Trip state machine**: Invalid status transitions corrupt business logic
3. **Mobile store race conditions**: Concurrent operations cause stale state
4. **NATS consumer crashes**: Unhandled errors bring down consumers

### Low Risk Areas (Phase 8-9)

1. **Database indexes**: Performance degradation over time
2. **Console.log noise**: Debug info in production
3. **UX polish**: User experience improvements

---

## Appendix A: Finding Index

### By ID Prefix

| Prefix | Domain | Document |
|--------|--------|----------|
| BGW-* | API Gateway | `docs/backend/api-gateway.md` |
| AUTH-* | Auth Service | `docs/backend/auth-service.md` |
| TRIP-* | Trip Service | `docs/backend/trip-service.md` |
| PAY-* | Payment Service | `docs/backend/payment-service.md` |
| ADM-* | Admin Service | `docs/backend/admin-service.md` |
| LOC-* | Location Service | `docs/backend/location-service.md` |
| MAT-* | Match Service | `docs/backend/match-service.md` |
| WS-* | WebSocket Server | `docs/backend/websocket-server.md` |
| PKG-* | Shared Packages | `docs/backend/shared-packages.md` |
| AUTH-DB-* | Auth Schema | `docs/backend/prisma-schemas.md` |
| TRIP-DB-* | Trip Schema | `docs/backend/prisma-schemas.md` |
| PAY-DB-* | Payment Schema | `docs/backend/prisma-schemas.md` |
| ADMIN-DB-* | Admin Schema | `docs/backend/prisma-schemas.md` |
| SCHEMA-CROSS-* | Cross-Schema | `docs/backend/prisma-schemas.md` |
| MOB-S-* | Mobile Screens | `docs/mobile/screens.md` |
| MOB-ST-* | Mobile Stores | `docs/mobile/stores.md` |
| MOB-API-* | Mobile API | `docs/mobile/api.md` |
| MOB-HK-* | Mobile Hooks | `docs/mobile/hooks-services.md` |
| MOB-NA-* | Mobile Navigation | `docs/mobile/navigation.md` |
| DASH-PG-* | Dashboard Pages | `docs/dashboard/pages.md` |
| AUTH-COMPARE-* | Auth Comparison | `docs/shared/auth-flow-comparison.md` |
| AUTH-WS-* | Auth/WebSocket | `docs/shared/auth-websocket.md` |
| COMP-* | Shared Components | `docs/shared/components.md` |
| DATA-* | Data Fetching | `docs/shared/data-fetching.md` |
| MOB-BE-* | Mobile-Backend CrossRef | `docs/shared/mobile-backend-crossref.md` |
| DASH-BE-* | Dashboard-Backend CrossRef | `docs/shared/dashboard-backend-crossref.md` |

### Document Index

| Document | Total Findings | Remaining |
|----------|---------------|-----------|
| `docs/backend/api-gateway.md` | 14 | 14 |
| `docs/backend/auth-service.md` | 16 | 15 |
| `docs/backend/trip-service.md` | 14 | 14 |
| `docs/backend/payment-service.md` | 12 | 12 |
| `docs/backend/admin-service.md` | 16 | 15 |
| `docs/backend/location-service.md` | 10 | 10 |
| `docs/backend/match-service.md` | 13 | 13 |
| `docs/backend/websocket-server.md` | 11 | 11 |
| `docs/backend/shared-packages.md` | 12 | 12 |
| `docs/backend/prisma-schemas.md` | 22 | 22 |
| `docs/mobile/screens.md` | 20 | 15 |
| `docs/mobile/stores.md` | 13 | 12 |
| `docs/mobile/api.md` | 15 | 11 |
| `docs/mobile/hooks-services.md` | 16 | 12 |
| `docs/mobile/navigation.md` | 10 | 9 |
| `docs/dashboard/pages.md` | 16 | 12 |
| `docs/shared/auth-flow-comparison.md` | 9 | 7 |
| `docs/shared/auth-websocket.md` | 13 | 9 |
| `docs/shared/components.md` | 14 | 9 |
| `docs/shared/data-fetching.md` | 13 | 9 |
| `docs/shared/mobile-backend-crossref.md` | 6 | 3 |
| `docs/shared/dashboard-backend-crossref.md` | 5 | 5 |

---

## Appendix B: Findings Fixed in Phases 1-4

The following findings were fully resolved and are **not** included in this roadmap:

| Finding | Phase | Fix Summary |
|---------|-------|-------------|
| AUTH-WS-001 WS auth | 1 | JWT token passed in WS connection URL |
| AUTH-WS-002 Token refresh race | 1 | Singleton refresh lock with request queue |
| AUTH-COMPARE-004 RBAC | 1 | Explicit role checks in mobile + dashboard |
| MOB-BE-001 Missing /settings routes | 1 | Gateway routes added |
| MOB-BE-002 Missing /support routes | 1 | Gateway routes added |
| AUTH-WS-004 Auth persistence | 2 | Zustand persist middleware |
| AUTH-WS-003 Background location token | 2 | Token refresh before stopping |
| DATA-002 Request cancellation | 2 | AbortController support |
| DATA-003 Query dedup | 2 | Pending requests map |
| MOB-S-003 Error boundaries | 2 | ErrorBoundary wrappers |
| DASH-PG-012 Error boundaries | 2 | ErrorBoundary wrappers |
| COMP-002 MapView error boundary | 2 | ErrorBoundary wrapper |
| DATA-004 Dashboard pagination | 2 | Pagination params in queries |
| DASH-PG-005 Form validation (promos) | 3 | `validation.ts` + CreatePromoModal |
| DASH-PG-006 Complaint validation | 3 | ComplaintDetailModal validation |
| DASH-PG-007 Profile validation | 3 | ProfilePage validation |
| MOB-API-007 Console.log (client) | 3 | 15 statements removed |
| COMP-003 Accessibility labels | 3 | ARIA props on LocationMarker, EmptyState, DataTable |
| COMP-012 PickupDropoffPins RTL | 3 | Arabic labels + `writingDirection: 'ltr'` |
| DATA-006 Optimistic updates | 3 | Complaint + promo mutations |
| MOB-API-004 / DATA-008 Retry logic | 3 | Exponential backoff in mobile client |
| MOB-API-003 / DATA-001 Token refresh | 1 | Singleton refresh lock |
| Typed error interfaces | 4 | `ApiErrorResponse` in mobile + dashboard |
| `any` type removal | 4 | Typed alternatives in mobile client |
| Query key factories | 4 | Spread pattern from `.all` in all queries |
| MapView types | 4 | `CameraRef`, `ViewStyle` |
| Config constants | 4 | `lib/config/constants.ts`, `config/constants.ts` |
| Hardcoded URLs | 4 | Config constants in 8 files |
| Haversine dedup | 4 | Shared function in `location.types.ts` |
| JSDoc comments | 4 | validation.ts, getApiError, haversineDistance |
| Refetch settings | 4 | `refetchOnWindowFocus` + `refetchOnReconnect` |
| WS heartbeat pause | 4 | Pause on background, resume on active |
| StatCard skeleton | 4 | `isLoading` skeleton state |
| DataTable emptyMessage | 4 | `emptyMessage` prop |
| i18n messages | 4 | `lib/messages.ts` centralized Arabic messages |
