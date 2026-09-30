# Tasks: OTP Provider Authentication

**Input**: Design documents from `/specs/004-otp-provider-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/verify-otp.yaml

**Tests**: Not explicitly requested - implementation-focused tasks only.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `apps/elysia/`, `apps/nest/`, `packages/`
- **Elysia services**: `apps/elysia/{service}/src/`
- **NestJS services**: `apps/nest/{service}/src/`
- **Shared packages**: `packages/{package}/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, environment configuration, and shared types

- [x] T001 Install firebase-admin dependency in `apps/nest/auth-service/package.json` by running `pnpm add firebase-admin` from the auth-service directory
- [x] T002 [P] Add `OTP_VERIFIED` subject to NATS_SUBJECTS constant in `packages/shared-types/src/events.types.ts` with value `"ain_rider.otp_verified"`
- [x] T003 [P] Add `OtpVerifiedEvent` interface to `packages/shared-types/src/events.types.ts` with fields: `phoneNumber: string`, `uid: string`, `verifiedAt: string`
- [x] T004 [P] Add `OtpVerifiedEvent` to the `NatsEvent` union type in `packages/shared-types/src/events.types.ts`
- [x] T005 [P] Add Firebase credentials pattern to `.gitignore` at repository root: add line `*firebase-adminsdk*.json` to prevent committing service account files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [P] Create `apps/nest/auth-service/src/auth/otp.service.ts` with OtpService class that:
  - Implements provider abstraction pattern with OtpProvider interface
  - Supports multiple providers via OTP_PROVIDER env var (console/firebase)
  - Includes circuit breaker for fault tolerance (threshold: 5 failures, timeout: 30s)
  - Validates provider initialization in onModuleInit()
  - Has `verify(idToken: string, traceId: string)` method that calls selected provider
  - Logs warnings if provider not initialized
  - Throws ServiceUnavailableException for circuit breaker open state
  - Throws UnauthorizedException for token verification failures
- [x] T007 [P] Register OtpService and providers in `apps/nest/auth-service/src/auth/auth.module.ts` by adding OtpService, FirebaseProvider, and ConsoleProvider to providers array
- [x] T008 Inject OtpService into AuthService constructor in `apps/nest/auth-service/src/auth/auth.service.ts` by adding `private otpService: OtpService` parameter

**Checkpoint**: Foundation ready with provider abstraction and circuit breaker - user story implementation can now begin

---

## Phase 3: User Story 1 - Phone Number Verification (Priority: P1) 🎯 MVP

**Goal**: Verify Firebase Phone Auth ID token and return phone number + uid

**Independent Test**: Call `POST /auth/verify-otp` with a valid Firebase ID token, receive `{ success: true, phoneNumber: "+...", uid: "..." }`

### Implementation for User Story 1

- [x] T009 [US1] Add `verifyOtp(idToken: string, traceId: string)` method to `apps/nest/auth-service/src/auth/auth.service.ts` that:
  - Calls `this.otpService.verify(idToken, traceId)` to get decoded token (uses provider abstraction)
  - Returns `{ success: true, phoneNumber: decodedToken.phone_number, uid: decodedToken.uid }` on success
  - Publishes `otp_verified` NATS event asynchronously (fire-and-forget with error logging)
  - Catches errors from OtpService and re-throws as UnauthorizedException
- [x] T010 [US1] Add `POST /auth/verify-otp` endpoint to `apps/nest/auth-service/src/auth/auth.controller.ts` that:
  - Has `@Post('verify-otp')` decorator
  - Has `@ApiOperation({ summary: 'Verify Firebase OTP ID token' })` decorator
  - Accepts `@Body() body: { idToken: string }` parameter
  - Generates traceId using `generateTraceId()` from `@ain-rider/nats-client`
  - Calls `this.authService.verifyOtp(body.idToken, traceId)`
  - Returns the result directly (NestJS auto-wraps in response)
- [x] T011 [P] [US1] Add `verifyOtpBody` validation schema to `apps/elysia/api-gateway/src/modules/auth/model.ts`:
  - Object with `idToken: t.String()` (non-empty string)
  - Export as part of AuthModel object
- [x] T012 [US1] Add `verifyOtp(body: { idToken: string })` method to `apps/elysia/api-gateway/src/modules/auth/service.ts` that:
  - Increments `proxyRequestsTotal` metric with service='auth-service', status='attempt'
  - Makes POST request to `${AUTH_SERVICE_URL}/auth/verify-otp` with JSON body
  - Handles fetch errors by incrementing metric with status='failed', logging error, re-throwing
  - Increments metric with status='success' or 'error' based on response.ok
  - Returns the Response object
- [x] T013 [US1] Add `POST /auth/verify-otp` route to `apps/elysia/api-gateway/src/modules/auth/index.ts` that:
  - Calls `AuthProxyService.verifyOtp(body as any)`
  - On success (res.ok), returns `res.json()`
  - On error, tries to parse JSON error body, sets `set.status = res.status`, returns error
  - On JSON parse failure, returns generic error `{ success: false, error: { code: "INTERNAL_ERROR", message: "..." } }`
  - Uses `{ body: AuthModel.verifyOtpBody }` for validation
- [x] T014 [US1] Add error handling for edge cases in `apps/nest/auth-service/src/auth/otp-providers/firebase.provider.ts`:
  - In `verify()`, catch errors and log with `console.error('[FirebaseProvider] Token verification failed:', error)`
  - Throw `Error('Invalid or expired Firebase ID token')` for any verification failure
  - Check if `admin.apps.length === 0` and throw `Error('Firebase Admin is not configured on the server')` before attempting verification

**Checkpoint**: At this point, User Story 1 should be fully functional - OTP verification returns phone + uid

---

## Phase 4: User Story 2 - OTP Event Publishing (Priority: P2)

**Goal**: Publish `otp_verified` NATS event after successful phone verification

**Independent Test**: Subscribe to `ain_rider.otp_verified` NATS subject, call `/auth/verify-otp`, verify event received with phoneNumber, uid, verifiedAt

### Implementation for User Story 2

- [x] T015 [US2] Add `publishOtpVerified(phoneNumber: string, uid: string, traceId: string)` method to `apps/nest/auth-service/src/events/user-event.publisher.ts` that:
  - Uses `this.publisher.publish()` with subject `NATS_SUBJECTS.OTP_VERIFIED`, event type `'otp_verified'`
  - Payload includes: `{ phoneNumber, uid, verifiedAt: new Date().toISOString() }`
  - Includes `{ traceId }` in options
  - Logs: `console.log('[UserEventPublisher] Published otp_verified | phoneNumber=${phoneNumber} | uid=${uid} | traceId=${traceId}')`
- [x] T016 [US2] Call `publishOtpVerified` in `apps/nest/auth-service/src/auth/auth.service.ts` within the `verifyOtp()` method:
  - After successfully extracting phoneNumber and uid, before returning
  - Call `await this.userEventPublisher.publishOtpVerified(phoneNumber, uid, traceId)` (fire-and-forget - don't await)
  - The UserEventPublisher should already be injected in constructor (verify it exists)

**Checkpoint**: At this point, User Story 2 should be fully functional - NATS event published on verification

---

## Phase 5: Rate Limiting (Cross-Cutting)

**Purpose**: Protect endpoint from abuse per spec requirements (FR-007)

**Note**: Rate limiting may already be implemented at gateway level. These tasks add OTP-specific limits.

- [x] T017 Create rate limiting middleware or use existing gateway rate limiter for `/auth/verify-otp` in `apps/elysia/api-gateway/src/modules/auth/index.ts`:
  - If using existing `elysia-rate-limit`, ensure `/auth/verify-otp` is covered
  - Target limits: 10 requests/minute per IP, 5 requests/hour per phone number
  - On limit exceeded, return HTTP 429 with `{ success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests. Please try again later." } }`
  - Include `Retry-After` header with seconds until reset
- [x] T018 Document rate limiting behavior in code comments at the top of the verify-otp route handler

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T019 [P] Add JSDoc comments to `FirebaseService.verifyIdToken()` explaining input/output and error cases
- [x] T020 [P] Add JSDoc comments to `AuthService.verifyOtp()` explaining the flow and NATS event publishing
- [x] T021 [P] Add JSDoc comments to `UserEventPublisher.publishOtpVerified()` explaining the event payload structure
- [x] T022 Update `AGENTS.md` with new technology: Add `firebase-admin` and `OTP provider abstraction` under Active Technologies and Recent Changes for feature 004
- [x] T023 [P] Verify all error responses follow constitution format `{ success: false, error: { code, message } }` by checking auth.controller.ts and api-gateway routes
- [x] T024 Run `pnpm --filter @ain-rider/shared-types build` to ensure shared-types compiles with new event types
- [ ] T025 Manual test: Start services, call `POST /auth/verify-otp` with test token, verify response format and NATS event

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS all user stories
    ↓
┌───────────────────────────────────────┐
│  Phase 3 (US1) ← MVP                  │
│  Phase 4 (US2) ← Depends on US1       │
└───────────────────────────────────────┘
    ↓
Phase 5 (Rate Limiting)
    ↓
Phase 6 (Polish)
```

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 (Foundational) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 completion - needs verifyOtp() method to exist to add event publishing

### Within Each User Story

- Service methods before controller endpoints
- Controller endpoints before gateway routes
- Gateway service methods before route handlers
- Core implementation before error handling refinements

### Parallel Opportunities

**Phase 1 (all parallel)**:

```
T002, T003, T004, T005 can run simultaneously (different files)
```

**Phase 3 (partial parallel)**:

```
T011 can run in parallel with T009, T010 (different service)
```

**Phase 6 (all parallel)**:

```
T019, T020, T021, T023 can run simultaneously (documentation tasks)
```

---

## Parallel Example: Phase 1

```bash
# These can all be done simultaneously by different agents/developers:
Task T002: "Add OTP_VERIFIED subject to events.types.ts"
Task T003: "Add OtpVerifiedEvent interface to events.types.ts"
Task T004: "Add OtpVerifiedEvent to NatsEvent union"
Task T005: "Add Firebase pattern to .gitignore"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, add types)
2. Complete Phase 2: Foundational (FirebaseService)
3. Complete Phase 3: User Story 1 (verify endpoint)
4. **STOP and VALIDATE**: Test OTP verification independently
5. Deploy/demo if ready - MVP complete!

### Full Feature Delivery

1. Complete Phases 1-3 (MVP)
2. Complete Phase 4: User Story 2 (NATS events)
3. Complete Phase 5: Rate Limiting
4. Complete Phase 6: Polish
5. Full feature ready for production

---

## Verification Checklist

After completing all tasks, verify:

- [ ] `POST /auth/verify-otp` returns `{ success: true, phoneNumber, uid }` for valid token
- [ ] `POST /auth/verify-otp` returns 401 for invalid/expired token
- [ ] `POST /auth/verify-otp` returns 400 for missing idToken
- [ ] NATS event `ain_rider.otp_verified` is published after successful verification
- [ ] Error responses follow `{ success: false, error: { code, message } }` format
- [ ] Firebase credentials JSON files are gitignored
- [ ] No Firebase service account files committed to repository

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Firebase credentials must NEVER be committed - use environment variables only
- For dev testing, `OTP_PROVIDER=console` can simulate verification without Firebase
