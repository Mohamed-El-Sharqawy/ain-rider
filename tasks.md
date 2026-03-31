# Tasks: Driver Registration Flow

**Input**: Design documents from `/specs/006-driver-registration-flow/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/auth-driver-routes.md

**Tests**: Not explicitly requested in the feature specification. Tasks focus on implementation and manual verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Key Context for Implementers

- **OTP endpoints already work** through the gateway (`POST /auth/request-otp` and `POST /auth/verify-otp` in `apps/elysia/api-gateway/src/modules/auth/index.ts` lines 307-365). User Story 1 is already fully functional — no code changes needed.
- **All driver onboarding endpoints already exist** in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`. The controller handles profile, status, identity upload, license upload, vehicle registration, and onboarding status.
- **The ONLY new auth-service code** is adding `licenseNumber` parameter to the `uploadDrivingLicense` method and controller (User Story 5).
- **The ONLY new gateway code** is adding 6 proxy routes in the auth module for `/auth/driver/*` endpoints (User Story 2).
- **No Prisma schema changes** — the schema already has all required fields including `Driver.licenseNumber` (unique, initially empty string).

---

## Phase 1: Setup (No Changes Needed)

**Purpose**: Verify existing infrastructure is functional.

No setup tasks required. All infrastructure (Docker Compose, MinIO, PostgreSQL, NATS) already exists. The Prisma schema already has all required models and fields.

---

## Phase 2: Foundational (No Changes Needed)

**Purpose**: Core infrastructure is already in place from spec 005.

No foundational tasks required. The following already exist and work:

- JWT authentication via `JwtAuthGuard` and `JwtStrategy` in `apps/nest/auth-service/src/auth/`
- Role guards: `DriverGuard` and `RiderGuard` in `apps/nest/auth-service/src/auth/guards/`
- `StorageModule` and `StorageService` in `apps/nest/auth-service/src/shared/storage/`
- `DriverOnboardingModule` in `apps/nest/auth-service/src/driver-onboarding/`
- Gateway auth guard in `apps/elysia/api-gateway/src/modules/auth/guard.ts`
- Gateway auth proxy service in `apps/elysia/api-gateway/src/modules/auth/service.ts`

**Checkpoint**: Foundation is already complete. User story implementation can begin immediately.

---

## Phase 3: User Story 1 - Phone-First Driver Registration via OTP (Priority: P1) ✅ ALREADY COMPLETE

**Goal**: Drivers can verify their phone via OTP, register with email/password/name, and receive authentication tokens.

**Independent Test**: Already working. Verify with:

```bash
curl -X POST http://localhost:3000/auth/request-otp -H "Content-Type: application/json" -d '{"phone":"+1234567890"}'
curl -X POST http://localhost:3000/auth/verify-otp -H "Content-Type: application/json" -d '{"phone":"+1234567890","code":"123456"}'
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"driver@test.com","password":"password123","phoneNumber":"+1234567890","firstName":"Test","lastName":"Driver","role":"DRIVER"}'
```

**No tasks needed.** The OTP request/verify endpoints and registration endpoint already exist and are proxied through the gateway. The registration endpoint (in `apps/nest/auth-service/src/auth/auth.service.ts`) already creates a Driver record with `PENDING_DOCUMENTS` status and empty `licenseNumber` when `role=DRIVER`.

**Coverage Notes** (existing implementations):
- **FR-005** (OTP rate limiting): Already implemented via `elysia-rate-limit` in gateway (`apps/elysia/api-gateway/src/modules/auth/index.ts` lines 307-316, max 15 requests per minute per IP)
- **FR-016** (403 for non-driver role): Already implemented via `DriverGuard` in `apps/nest/auth-service/src/auth/guards/driver.guard.ts`
- **FR-017** (profile updates after approval): Already supported - the PATCH endpoint has no approval status restriction
- **FR-030** (online status restricted to APPROVED): Already implemented in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts` lines 37-42

**Checkpoint**: User Story 1 is fully functional and testable.

---

## Phase 4: User Story 2 - API Gateway Proxy for Driver Endpoints (Priority: P1) 🎯 MVP

**Goal**: Add 6 proxy routes in the gateway so all `/auth/driver/*` endpoints are reachable from the mobile app through port 3000.

**Independent Test**: After completing this phase, verify by:

```bash
# 1. Register a driver and get token (reuse from US1)
TOKEN="<access_token_from_register>"

# 2. Test GET endpoint through gateway
curl http://localhost:3000/auth/driver/onboarding-status -H "Authorization: Bearer $TOKEN"

# 3. Test PATCH endpoint through gateway
curl -X PATCH http://localhost:3000/auth/driver/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"123 Main St"}'

# 4. Test that unauthenticated requests are rejected
curl http://localhost:3000/auth/driver/onboarding-status
# Expected: 401 Unauthorized
```

### Implementation for User Story 2

- [ ] T001 [US2] Add 6 static proxy methods to `AuthProxyService` in `apps/elysia/api-gateway/src/modules/auth/service.ts`. Add these methods after the existing `uploadRiderIdentity` method (after line 153):

  **Method 1: `proxyDriverGet`** — Generic GET proxy for driver endpoints. Parameters: `(token: string, path: string)`. Makes GET fetch to `${AUTH_SERVICE_URL}/auth/driver/${path}` with `Authorization: Bearer ${token}` header. Includes metrics tracking (`proxyRequestsTotal.inc`) and error logging, matching the exact pattern of the existing `getMe` method (lines 98-114).

  **Method 2: `proxyDriverPatch`** — Generic PATCH proxy for driver JSON endpoints. Parameters: `(token: string, path: string, body: unknown)`. Makes PATCH fetch to `${AUTH_SERVICE_URL}/auth/driver/${path}` with `Authorization` and `Content-Type: application/json` headers, body serialized with `JSON.stringify(body)`. Includes metrics tracking and error logging, matching the pattern of `adminCreateUser` (lines 116-134).

  **Method 3: `proxyDriverMultipart`** — Generic POST proxy for driver multipart upload endpoints. Parameters: `(token: string, path: string, contentType: string, rawBody: ArrayBuffer)`. Makes POST fetch to `${AUTH_SERVICE_URL}/auth/driver/${path}` with `Authorization: Bearer ${token}` and `Content-Type: ${contentType}` headers, body as `rawBody` (the raw ArrayBuffer). Includes metrics tracking and error logging, matching the pattern of the inline rider identity upload (lines 367-411 in `index.ts`).

  **Method 4: `proxyDriverPatchMultipart`** — Generic PATCH proxy for driver multipart endpoints. Same as Method 3 but uses PATCH HTTP method instead of POST. Parameters: `(token: string, path: string, contentType: string, rawBody: ArrayBuffer)`.

  Each method must follow the exact error handling pattern from the existing code: increment `proxyRequestsTotal` with `{ service: 'auth-service', status: 'attempt' }` on start, `'success'` or `'error'` on response, and `'failed'` on catch. Log errors with `log('error', '...', { error: String(error) })`.

- [ ] T002 [US2] Add 6 driver proxy route handlers in `apps/elysia/api-gateway/src/modules/auth/index.ts`. Append these routes after the existing `/rider/profile/image` PATCH handler (after line 458), still chained on the same `auth` Elysia instance. Each route follows the same inline pattern as the existing rider upload routes (lines 367-458). All routes extract the Bearer token from `request.headers`, check it exists (throw 401 if not), then proxy to auth-service.

  **Route 1: GET `/driver/onboarding-status`**
  - Extract Bearer token from `request.headers.get("authorization")`. If missing, throw `status(401, "Not authenticated")`.
  - Call `AuthProxyService.proxyDriverGet(token, "onboarding-status")`.
  - If `!res.ok`, parse error JSON and return with `set.status = res.status`. Use the same try/catch error parsing pattern from lines 393-408 of the existing rider identity route.
  - If ok, return `res.json()`.
  - Log: `console.log('[Gateway] Driver onboarding-status proxy:', res.status)`.

  **Route 2: PATCH `/driver/profile`**
  - Extract Bearer token (same 401 check as Route 1).
  - Read the raw body: `const body = await request.json()`.
  - Call `AuthProxyService.proxyDriverPatch(token, "profile", body)`.
  - Same error handling pattern as Route 1.
  - If ok, return `res.json()`.

  **Route 3: PATCH `/driver/status`**
  - Extract Bearer token (same 401 check).
  - Read the raw body: `const body = await request.json()`.
  - Call `AuthProxyService.proxyDriverPatch(token, "status", body)`.
  - Same error handling pattern.
  - If ok, return `res.json()`.

  **Route 4: POST `/driver/documents/identity`** (multipart file upload)
  - Extract Bearer token (same 401 check).
  - Check Content-Length header: `const contentLength = parseInt(request.headers.get("content-length") || "0")`. If `contentLength > 10 * 1024 * 1024`, throw `status(413, "Request too large. Maximum total size is 10MB")`.
  - Read the raw body: `const rawBody = await request.arrayBuffer()`.
  - Get content-type: `const contentType = request.headers.get("content-type")`.
  - Log: `console.log('[Gateway] Forwarding driver identity upload, Content-Type:', contentType, 'Body size:', rawBody.byteLength)`.
  - Call `AuthProxyService.proxyDriverMultipart(token, "documents/identity", contentType || 'multipart/form-data', rawBody)`.
  - Same error handling pattern.
  - If ok, return `res.json()`.

  **Route 5: POST `/driver/documents/driving-license`** (multipart file upload)
  - Same exact pattern as Route 4, but path is `"documents/driving-license"`.
  - Include the same Content-Length check (throw 413 if > 10MB).
  - Log: `'[Gateway] Forwarding driver driving-license upload'`.
  - Call `AuthProxyService.proxyDriverMultipart(token, "documents/driving-license", contentType || 'multipart/form-data', rawBody)`.

  **Route 6: POST `/driver/vehicle`** (multipart file upload with form fields)
  - Same pattern as Route 4, but path is `"vehicle"`.
  - Include the same Content-Length check (throw 413 if > 10MB).
  - Log: `'[Gateway] Forwarding driver vehicle registration'`.
  - Call `AuthProxyService.proxyDriverMultipart(token, "vehicle", contentType || 'multipart/form-data', rawBody)`.

- [ ] T003 [US2] Verify all 6 gateway driver routes work by running the auth-service and gateway, then testing each route with curl:
  1. Register a driver and get a JWT token
  2. `curl http://localhost:3000/auth/driver/onboarding-status -H "Authorization: Bearer $TOKEN"` → expect 200 with PENDING_DOCUMENTS
  3. `curl -X PATCH http://localhost:3000/auth/driver/profile -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"address":"123 Test St"}'` → expect 200
  4. `curl http://localhost:3000/auth/driver/onboarding-status` (no auth) → expect 401
  5. `curl -X PATCH http://localhost:3000/auth/driver/status -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"isOnline":true}'` → expect 400 "Only approved drivers can go online"
  6. Test multipart routes after preparing test image files (or defer to US4/US5/US6 testing)

**Checkpoint**: At this point, all 6 driver endpoints are reachable through the gateway. The onboarding-status and profile endpoints should work end-to-end. Document upload routes will work but don't yet accept `licenseNumber` (that's US5).

---

## Phase 5: User Story 3 - Driver Profile Completion (Priority: P1)

**Goal**: Driver profile update endpoint works through the gateway.

**Independent Test**: Already covered by T003. The `PATCH /auth/driver/profile` endpoint already exists in auth-service (`driver-onboarding.controller.ts` lines 38-48) and uses `UpdateDriverProfileDto` validation. After US2 completes, this works end-to-end through the gateway.

**No new tasks needed.** The auth-service endpoint is already implemented and the gateway proxy was added in T002 Route 2.

**Checkpoint**: Profile completion is functional through the gateway.

---

## Phase 6: User Story 4 - Identity Document Upload (Priority: P2)

**Goal**: Identity document upload (3 images) works through the gateway.

**Independent Test**: After completing, test with:

```bash
# Create 3 small test images (or use real JPGs)
curl -X POST http://localhost:3000/auth/driver/documents/identity \
  -H "Authorization: Bearer $TOKEN" \
  -F "file1=@test1.jpg" \
  -F "file2=@test2.jpg" \
  -F "file3=@test3.jpg"
# Expected: 200 with presigned URLs and PENDING status
```

**No new tasks needed.** The auth-service endpoint is already fully implemented (`driver-onboarding.controller.ts` lines 62-96, `driver-onboarding.service.ts` `uploadIdentityDocuments` method lines 169-245). The gateway proxy was added in T002 Route 4.

**Checkpoint**: Identity document upload is functional through the gateway.

---

## Phase 7: User Story 5 - Driving License Upload with License Number (Priority: P2)

**Goal**: Modify the driving license upload to also accept and persist a `licenseNumber` field. The license number is a required multipart form field alongside the 2 license image files.

**Independent Test**: After completing, test with:

```bash
curl -X POST http://localhost:3000/auth/driver/documents/driving-license \
  -H "Authorization: Bearer $TOKEN" \
  -F "licenseNumber=DL-12345" \
  -F "file1=@license_front.jpg" \
  -F "file2=@license_back.jpg"
# Expected: 200, license number saved, presigned URLs returned

# Test duplicate license number rejection:
# Register a second driver, then try the same license number
curl -X POST http://localhost:3000/auth/driver/documents/driving-license \
  -H "Authorization: Bearer $TOKEN2" \
  -F "licenseNumber=DL-12345" \
  -F "file1=@license_front.jpg" \
  -F "file2=@license_back.jpg"
# Expected: 409 Conflict

# Test missing license number:
curl -X POST http://localhost:3000/auth/driver/documents/driving-license \
  -H "Authorization: Bearer $TOKEN" \
  -F "file1=@license_front.jpg" \
  -F "file2=@license_back.jpg"
# Expected: 400 "License number is required"
```

### Implementation for User Story 5

- [ ] T004 [US5] Modify `uploadDrivingLicense` controller method in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts` to extract the `licenseNumber` form field alongside the file parts. Currently (lines 103-134), the method only collects files from `req.parts()`. Change it to also collect fields:

  **Current code** (lines 103-134): Iterates `req.parts()`, pushes only `file` type parts into `files` array, validates exactly 2 files, processes them, then calls `this.service.uploadDrivingLicense(req.user.sub, processedFiles)`.

  **New code**:
  1. Add a `fields` map: `const fields: Record<string, string> = {};` (same pattern as `registerVehicle` method at line 143).
  2. In the `for await (const part of parts)` loop (line 107), add an `else if (part.type === "field")` branch that stores `fields[(part as any).fieldname] = (part as any).value` (same as line 149-150).
  3. After the file count validation (line 117), add a license number validation: extract `const licenseNumber = fields["licenseNumber"]`. If `!licenseNumber || licenseNumber.trim() === ""`, throw `new BadRequestException("License number is required")`.
  4. Change the service call (line 129) from `(this.service as any).uploadDrivingLicense(req.user.sub, processedFiles)` to `(this.service as any).uploadDrivingLicense(req.user.sub, processedFiles, licenseNumber)`.

- [ ] T005 [US5] Modify `uploadDrivingLicense` service method in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts` to accept and persist the `licenseNumber` parameter with duplicate checking.

  **Step 1**: Change the method signature (line 247) from `async uploadDrivingLicense(userId: string, files: UploadedFile[])` to `async uploadDrivingLicense(userId: string, files: UploadedFile[], licenseNumber: string)`.

  **Step 2**: Add the import for `ConflictException` at the top of the file. Add `ConflictException` to the import from `@nestjs/common` on line 3 (add it to the existing import list).

  **Step 3**: Add duplicate license number check AFTER the driver lookup (after line 265, before the upload attempt check). Insert this code:

  ```typescript
  const existingDriverWithLicense = await this.prisma.driver.findFirst({
    where: {
      licenseNumber,
      NOT: { id: driver.id },
    },
  });
  if (existingDriverWithLicense) {
    throw new ConflictException(
      "This license number is already registered to another driver",
    );
  }
  ```

  **Step 4**: After the `driverDocument.upsert` call (after line 311) and BEFORE the `checkAndTransitionToUnderReview` call, add code to save the license number to the Driver record:

  ```typescript
  await this.prisma.driver.update({
    where: { id: driver.id },
    data: { licenseNumber },
  });
  ```

  This saves the license number to the Driver record, replacing the empty string placeholder that was set during registration.

- [ ] T006 [US5] Verify the modified driving license upload works end-to-end:
  1. Start auth-service and gateway
  2. Register a driver, get token
  3. Upload driving license with license number via gateway: `curl -X POST http://localhost:3000/auth/driver/documents/driving-license -H "Authorization: Bearer $TOKEN" -F "licenseNumber=TEST-12345" -F "file1=@test1.jpg" -F "file2=@test2.jpg"` → expect 200
  4. Check onboarding status to verify license number was saved: `curl http://localhost:3000/auth/driver/onboarding-status -H "Authorization: Bearer $TOKEN"` → should show drivingLicense uploadAttempts=1
  5. Register a second driver, try same license number → expect 409
  6. Try upload without licenseNumber field → expect 400

**Checkpoint**: Driving license upload now accepts and persists the license number. Duplicate license numbers are rejected with 409. The gateway multipart proxy (T002 Route 5) forwards the licenseNumber form field correctly since it proxies the raw body.

---

## Phase 8: User Story 6 - Vehicle Registration (Priority: P2)

**Goal**: Vehicle registration endpoint works through the gateway.

**Independent Test**: After completing, test with:

```bash
curl -X POST http://localhost:3000/auth/driver/vehicle \
  -H "Authorization: Bearer $TOKEN" \
  -F "make=Toyota" \
  -F "model=Camry" \
  -F "year=2020" \
  -F "color=White" \
  -F "plateNumber=AB-1234" \
  -F "carImage=@car.jpg" \
  -F "carLicenseImage=@license.jpg"
# Expected: 200 with vehicle record and presigned URLs
```

**No new tasks needed.** The auth-service endpoint is already fully implemented (`driver-onboarding.controller.ts` lines 136-190, `driver-onboarding.service.ts` `registerVehicle` method lines 325-474). The gateway proxy was added in T002 Route 6.

**Checkpoint**: Vehicle registration is functional through the gateway.

---

## Phase 9: User Story 7 - Onboarding Status and Progress Tracking (Priority: P2)

**Goal**: Onboarding status endpoint works through the gateway, returns accurate state with presigned URLs.

**Independent Test**: After completing all document uploads (US4 + US5 + US6), verify:

```bash
curl http://localhost:3000/auth/driver/onboarding-status -H "Authorization: Bearer $TOKEN"
# Expected: UNDER_REVIEW with all document types showing images and presigned URLs
```

**No new tasks needed.** The auth-service endpoint is already fully implemented (`driver-onboarding.controller.ts` lines 192-199, `driver-onboarding.service.ts` `getOnboardingStatus` method lines 476-558). The gateway proxy was added in T002 Route 1. The auto-transition logic (`checkAndTransitionToUnderReview`) already works (lines 142-167).

**Checkpoint**: Onboarding status tracking is functional through the gateway.

---

## Phase 10: User Story 8 - Driver Online Status Toggle (Priority: P3)

**Goal**: Online status toggle works through the gateway, restricted to APPROVED drivers.

**Independent Test**: After completing, test with:

```bash
# As PENDING_DOCUMENTS driver:
curl -X PATCH http://localhost:3000/auth/driver/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isOnline":true}'
# Expected: 400 "Only approved drivers can go online"

# After admin approves (or manually set status in DB):
curl -X PATCH http://localhost:3000/auth/driver/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isOnline":true}'
# Expected: 200 with isOnline: true
```

**No new tasks needed.** The auth-service endpoint is already fully implemented (`driver-onboarding.controller.ts` lines 50-59, `driver-onboarding.service.ts` `updateOnlineStatus` method lines 28-54). The gateway proxy was added in T002 Route 3.

**Checkpoint**: Online status toggle is functional through the gateway.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end flow validation and cleanup.

- [ ] T007 Run the full quickstart flow from the spec to verify the complete registration journey works through the gateway:
  1. Start all services: `docker compose up -d`, then auth-service (port 4000) and gateway (port 3000)
  2. Request OTP for a new phone number via `POST http://localhost:3000/auth/request-otp`
  3. Verify OTP with code `123456` via `POST http://localhost:3000/auth/verify-otp`
  4. Register driver via `POST http://localhost:3000/auth/register`
  5. Update profile via `PATCH http://localhost:3000/auth/driver/profile`
  6. Upload 3 identity images via `POST http://localhost:3000/auth/driver/documents/identity`
  7. Upload driving license with license number via `POST http://localhost:3000/auth/driver/documents/driving-license`
  8. Register vehicle via `POST http://localhost:3000/auth/driver/vehicle`
  9. Check onboarding status via `GET http://localhost:3000/auth/driver/onboarding-status` → should show UNDER_REVIEW
  10. Verify presigned URLs are accessible (open in browser or curl them)
  11. Verify unauthenticated request to `/auth/driver/onboarding-status` returns 401

- [ ] T008 Verify the `AUTH_SERVICE_URL` environment variable is documented in the gateway's `.env.example` or configuration. Check `apps/elysia/api-gateway/.env` or `.env.example` for `AUTH_SERVICE_URL=http://localhost:4000`. If no `.env.example` exists, check that the default value in `service.ts` line 5 (`'http://localhost:4000'`) is correct and that Docker Compose network routing works with this default.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 3 (US1)**: Already complete — no action needed
- **Phase 4 (US2)**: Can start immediately — this is the ONLY phase with real coding work
- **Phase 5-10 (US3-US8)**: All depend on Phase 4 (US2) gateway routes being complete. US5 has one additional code change (license number).
- **Phase 11 (Polish)**: Depends on US2 and US5 code changes being complete

### User Story Dependencies

- **US1**: ✅ Already complete (OTP + registration endpoints exist)
- **US2**: Must complete first — gateway proxy routes block all other stories
- **US3**: Depends on US2 (needs gateway route for profile endpoint)
- **US4**: Depends on US2 (needs gateway route for identity upload)
- **US5**: Depends on US2 (needs gateway route) + has auth-service code changes (T004, T005)
- **US6**: Depends on US2 (needs gateway route for vehicle registration)
- **US7**: Depends on US2 (needs gateway route for onboarding status)
- **US8**: Depends on US2 (needs gateway route for status toggle)

### Actual Work Summary

| What                                     | Tasks            | Effort |
| ---------------------------------------- | ---------------- | ------ |
| Gateway proxy routes (6 endpoints)       | T001, T002, T003 | Medium |
| License number in driving license upload | T004, T005, T006 | Small  |
| End-to-end verification                  | T007, T008       | Small  |

### Parallel Opportunities

- T001 and T004/T005 can be done in parallel (different files: gateway service vs auth-service controller/service)
- US3, US4, US6, US7, US8 are all "already done" — they just need US2 gateway routes to be functional

---

## Parallel Example: Core Implementation

```bash
# These can run in parallel since they modify different files:
Task T001: "Add proxy methods to apps/elysia/api-gateway/src/modules/auth/service.ts"
Task T004: "Modify apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts"

# These must be sequential:
Task T001 → Task T002 (routes depend on proxy methods existing)
Task T004 → Task T005 (controller depends on service signature matching)
```

---

## Implementation Strategy

### MVP First (User Story 2 Only — Gateway Routes)

1. Complete T001: Add proxy methods to `AuthProxyService`
2. Complete T002: Add 6 driver gateway routes
3. Complete T003: Verify gateway routes work
4. **STOP and VALIDATE**: Test all 6 endpoints through the gateway

### Then Add License Number (User Story 5)

1. Complete T004: Modify controller to extract `licenseNumber`
2. Complete T005: Modify service to validate and save `licenseNumber`
3. Complete T006: Verify end-to-end

### Then Validate Full Flow

1. Complete T007: Run complete quickstart flow
2. Complete T008: Verify environment configuration

---

## Notes

- The vast majority of this feature (US1, US3, US4, US6, US7, US8) is already implemented in the auth-service from spec 005. The primary new work is the gateway proxy routes.
- Only 2 files need code changes: `apps/elysia/api-gateway/src/modules/auth/service.ts` (new proxy methods) and `apps/elysia/api-gateway/src/modules/auth/index.ts` (new routes), plus `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts` and `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts` (license number).
- Total: 4 files modified, 0 new files created, 0 schema changes.
