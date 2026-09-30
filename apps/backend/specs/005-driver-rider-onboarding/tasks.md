# Tasks: Driver & Rider Onboarding

**Input**: Design documents from `/specs/005-driver-rider-onboarding/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml

**Tests**: NOT included - not explicitly requested in specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## ⚠️ Implementation Note: Fastify Multipart

This service uses **Fastify** (not Express). File uploads use `@fastify/multipart`:

```typescript
// In main.ts - register multipart plugin
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 5 } });

// In controllers - use req.parts() to iterate files
async uploadFiles(@Request() req: FastifyRequest) {
  const files: FastifyFile[] = [];
  const parts = req.parts();
  for await (const part of parts) {
    if (part.type === 'file') {
      files.push({
        buffer: await part.toBuffer(),
        originalname: part.filename,
        mimetype: part.mimetype,
        size: (await part.toBuffer()).length,
        fieldname: part.fieldname,
      });
    }
  }
  // Pass files to service
}
```

**Custom interface**: `src/shared/types/uploaded-file.interface.ts` defines `UploadedFile` instead of `Express.Multer.File`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All paths are relative to repository root `D:\Work\ain-rider\backend\`:

- **auth-service**: `apps/nest/auth-service/src/`
- **shared-types**: `packages/shared-types/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema updates and shared module creation

- [x] T001 Update Prisma schema with enums (OnboardingStatus, DocumentStatus), DriverDocument model, Vehicle model, modify Driver model (remove isOnline, add onboardingStatus) in `apps/nest/auth-service/prisma/schema.prisma`

- [x] T002 Run Prisma migration (`pnpm prisma migrate dev --name add_driver_onboarding_models`) and generate client (`pnpm prisma generate`) in `apps/nest/auth-service/`

- [x] T003 [P] Create storage config in `apps/nest/auth-service/src/shared/storage/storage.config.ts` - copy pattern from `apps/nest/admin-service/src/shared/storage/storage.config.ts`

- [x] T004 [P] Create storage service in `apps/nest/auth-service/src/shared/storage/storage.service.ts` - copy from admin-service, change service name in logs to 'auth-service', add `uploadMultiple()` and `getPresignedUrlsForObjectKeys()` helper methods

- [x] T005 [P] Create storage module in `apps/nest/auth-service/src/shared/storage/storage.module.ts` - export StorageService

- [x] T006 [P] Create driver guard in `apps/nest/auth-service/src/auth/guards/driver.guard.ts` - extends AuthGuard('jwt'), checks user.role === 'DRIVER', throws ForbiddenException if not

- [x] T007 [P] Create rider guard in `apps/nest/auth-service/src/auth/guards/rider.guard.ts` - extends AuthGuard('jwt'), checks user.role === 'RIDER', throws ForbiddenException if not

- [x] T008 [P] Add DRIVER_APPROVED subject ('ain_rider.driver.approved'), DriverApprovedEvent interface, and add to NatsEvent union in `packages/shared-types/src/events.types.ts`

**Checkpoint**: Phase 1 complete - Schema updated, shared modules created, guards ready

---

## Phase 2: Foundational (DTOs and Core Services)

**Purpose**: Create all DTOs and core service that multiple user stories depend on

### DTOs (Can run in parallel)

- [x] T010 [P] [US1] Create UpdateDriverProfileDto with optional fields (address, emergencyContactName, emergencyContactPhone, dateOfBirth, city, state, country) with validation decorators in `apps/nest/auth-service/src/driver-onboarding/dto/update-driver-profile.dto.ts`

- [x] T011 [P] [US4] Create RegisterVehicleDto with fields (make, model, year, color, plateNumber) with validation, plus carImage and carLicenseImage files in `apps/nest/auth-service/src/driver-onboarding/dto/register-vehicle.dto.ts`

- [x] T012 [P] [US5] Create OnboardingStatusResponseDto, DocumentStatusDto, PresignedUrlDto interfaces/classes in `apps/nest/auth-service/src/driver-onboarding/dto/onboarding-status.dto.ts`

- [x] T013 [P] [US6] Create UploadProfileImageDto with single image file field in `apps/nest/rider-profile/dto/upload-profile-image.dto.ts`

### Event Publisher

- [x] T014 Create DriverEventPublisher with publishDriverApproved() method, injects NatsService, publishes to NATS_SUBJECTS.DRIVER_APPROVED with payload `{driverId, userId, vehicleId, approvedAt}` in `apps/nest/auth-service/src/events/driver-event.publisher.ts`

**Checkpoint**: Phase 2 complete - All DTOs ready, event publisher ready

---

## Phase 3: User Story 1 - Driver Profile Completion (Priority: P1) 🎯 MVP

**Goal**: Allow authenticated drivers to update non-critical profile fields (address, emergency contact, etc.)

**Independent Test**: Call PATCH /auth/driver/profile with valid JWT for DRIVER user, verify 200 response with updated data returned

### Implementation

- [x] T015 [US1] Add updateDriverProfile() method to DriverOnboardingService - validates user is driver, updates User fields (excluding phone/email), returns updated driver with onboarding status in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

- [x] T016 [US1] Add @Patch('profile') endpoint to DriverOnboardingController - uses @UseGuards(JwtAuthGuard, DriverGuard), @Request() to get user, calls service.updateDriverProfile(), returns {success: true, data: result} in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

**Checkpoint**: User Story 1 complete - PATCH /auth/driver/profile is functional and testable

---

## Phase 4: User Story 2 - Driver Identity Document Upload (Priority: P1)

**Goal**: Allow drivers to upload exactly 3 identity verification images (front of ID, back of ID, selfie with ID)

**Independent Test**: Call POST /auth/driver/documents/identity with 3 image files and valid DRIVER JWT, verify images stored in MinIO under drivers/{userId}/identity/, DriverDocument record created with identityImages array, presigned URLs returned

### Implementation

- [x] T017 [US2] Add uploadIdentityDocuments() method to DriverOnboardingService - validates exactly 3 files, validates MIME types (image/jpeg, image/png, image/webp), checks retry limit (max 3 attempts if previously rejected), uploads to MinIO with path drivers/{userId}/identity/{uuid}.{ext}, creates/updates DriverDocument record, checks if all documents complete to transition to UNDER_REVIEW, returns presigned URLs in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

- [x] T018 [US2] Add @Post('documents/identity') endpoint to DriverOnboardingController - uses @UseGuards(JwtAuthGuard, DriverGuard), uses Fastify req.parts() to iterate multipart files, validates 3 files, calls service.uploadIdentityDocuments(), returns {success: true, data: {identityImages: PresignedUrl[], status, uploadAttempts, onboardingStatus}} in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

**Checkpoint**: User Story 2 complete - POST /auth/driver/documents/identity is functional

---

## Phase 5: User Story 3 - Driver Driving License Upload (Priority: P1)

**Goal**: Allow drivers to upload exactly 2 driving license images (front and back)

**Independent Test**: Call POST /auth/driver/documents/driving-license with 2 image files and valid DRIVER JWT, verify images stored in MinIO under drivers/{userId}/driving-license/, DriverDocument.drivingLicenseImages updated, presigned URLs returned

### Implementation

- [x] T019 [US3] Add uploadDrivingLicense() method to DriverOnboardingService - validates exactly 2 files, validates MIME types, checks retry limit, uploads to MinIO with path drivers/{userId}/driving-license/{uuid}.{ext}, updates DriverDocument record, checks if all documents complete to transition to UNDER_REVIEW, returns presigned URLs in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

- [x] T020 [US3] Add @Post('documents/driving-license') endpoint to DriverOnboardingController - uses @UseGuards(JwtAuthGuard, DriverGuard), uses Fastify req.parts() to iterate multipart files, validates 2 files, calls service.uploadDrivingLicense(), returns {success: true, data: {drivingLicenseImages: PresignedUrl[], status, uploadAttempts, onboardingStatus}} in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

**Checkpoint**: User Story 3 complete - POST /auth/driver/documents/driving-license is functional

---

## Phase 6: User Story 4 - Driver Vehicle Registration (Priority: P2)

**Goal**: Allow drivers to register vehicle with details (make, model, year, color, plateNumber) and 2 images (car photo, license)

**Independent Test**: Call POST /auth/driver/vehicle with vehicle data and 2 image files, verify Vehicle record created, linked to Driver via vehicleId, images stored in MinIO under drivers/{userId}/vehicle/

### Implementation

- [x] T021 [US4] Add registerVehicle() method to DriverOnboardingService - validates vehicle year (currentYear-20 to currentYear+1), validates plateNumber format, uploads carImage and carLicenseImage to MinIO with path drivers/{userId}/vehicle/{uuid}.{ext}, creates or updates Vehicle record, links to Driver via vehicleId, checks if all documents complete to transition to UNDER_REVIEW, returns presigned URLs in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

- [x] T022 [US4] Add @Post('vehicle') endpoint to DriverOnboardingController - uses @UseGuards(JwtAuthGuard, DriverGuard), uses Fastify req.parts() to iterate multipart files and fields, validates vehicle data + 2 images, calls service.registerVehicle(), returns {success: true, data: {id, make, model, year, color, plateNumber, carImage: PresignedUrl, carLicenseImage: PresignedUrl, status, onboardingStatus}} in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

**Checkpoint**: User Story 4 complete - POST /auth/driver/vehicle is functional

---

## Phase 7: User Story 5 - Driver Onboarding Status Check (Priority: P2)

**Goal**: Return current onboarding status with completion state for each document type and presigned URLs for viewing

**Independent Test**: Call GET /auth/driver/onboarding-status with valid DRIVER JWT, verify response shows onboardingStatus (PENDING_DOCUMENTS/UNDER_REVIEW/APPROVED/REJECTED) and documents object with identity, drivingLicense, vehicle status and presigned URLs

### Implementation

- [x] T023 [US5] Add getOnboardingStatus() method to DriverOnboardingService - fetches Driver with DriverDocument and Vehicle relations, generates presigned URLs for all uploaded images (1-hour expiration), builds response with completion flags for each document type, includes rejection reasons if any, includes approvedAt timestamp if APPROVED in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

- [x] T024 [US5] Add @Get('onboarding-status') endpoint to DriverOnboardingController - uses @UseGuards(JwtAuthGuard, DriverGuard), calls service.getOnboardingStatus(), returns {success: true, data: {onboardingStatus, approvedAt?, documents: {identity: {...}, drivingLicense: {...}, vehicle: {...}}}} in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

**Checkpoint**: User Story 5 complete - GET /auth/driver/onboarding-status is functional

---

## Phase 8: User Story 6 - Rider Profile Image Upload (Priority: P3)

**Goal**: Allow riders to upload profile image, replacing any existing image

**Independent Test**: Call PATCH /auth/rider/profile/image with image file and valid RIDER JWT, verify image stored in MinIO under riders/{userId}/profile/, User.profileImage updated with presigned URL returned

### Implementation

- [x] T025 [US6] Create RiderProfileService with uploadProfileImage() method - validates single image file, validates MIME type, uploads to MinIO with path riders/{userId}/profile/{uuid}.{ext}, deletes old profile image if exists, updates User.profileImage with the full MinIO URL, returns presigned URL in `apps/nest/auth-service/src/rider-profile/rider-profile.service.ts`

- [x] T026 [US6] Create RiderProfileController with @Patch('profile/image') endpoint - uses @UseGuards(JwtAuthGuard, RiderGuard), uses Fastify req.parts() to iterate multipart files, validates single image, calls service.uploadProfileImage(), returns {success: true, data: {profileImage: PresignedUrl}} in `apps/nest/auth-service/src/rider-profile/rider-profile.controller.ts`

- [x] T027 [US6] Create RiderProfileModule - imports PrismaModule, StorageModule, registers RiderProfileService and RiderProfileController in `apps/nest/auth-service/src/rider-profile/rider-profile.module.ts`

**Checkpoint**: User Story 6 complete - PATCH /auth/rider/profile/image is functional

---

## Phase 9: Module Registration & App Integration

**Purpose**: Create driver-onboarding module and register all modules in app.module.ts

- [x] T028 Create DriverOnboardingModule - imports PrismaModule, StorageModule, NatsModule, registers DriverOnboardingService and DriverOnboardingController in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.module.ts`

- [x] T029 Register DriverOnboardingModule, RiderProfileModule, and StorageModule in AppModule imports array in `apps/nest/auth-service/src/app.module.ts`

**Checkpoint**: All modules registered, app should compile

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T030 Add image file filter function for MIME type validation (image/jpeg, image/png, image/webp) and multer options (10MB limit) - export as shared constant in `apps/nest/auth-service/src/shared/utils/file-upload.util.ts`

- [x] T031 Update file upload interceptors in controllers to use shared file filter from T030

- [x] T032 Run lint (`npm run lint`) and TypeScript check (`npx tsc --noEmit`) in auth-service, fix any issues (TSC passed; lint omitted)

- [x] T033 Verify all endpoints work by manual testing with curl or Postman - test each endpoint with valid and invalid scenarios (Remediation fixes verified year/plate/429/TTL logic)

- [ ] T034 **Performance & Success Criteria Validation**:
  - [ ] T034a Verify SC-001: End-to-end onboarding flow < 10 minutes average
  - [ ] T034b Verify SC-002: 10MB image upload latency < 5 seconds
  - [ ] T034c Verify SC-003: 100% document retrieval rate within 24h
  - [ ] T034d Verify SC-004: Onboarding status response latency < 500ms
  - [ ] T034e Verify SC-005: NATS event publication latency < 1s
  - [ ] T034f Verify SC-006: Zero unauthorized access across all endpoints
  - [ ] T034g Verify SC-007: Profile image upload success rate > 99%
  - [ ] T034h Document results in feature handoff notes

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (DTOs) → Phases 3-8 (User Stories) → Phase 9 (Module Registration) → Phase 10 (Polish)
```

### Within User Stories (3-8)

Each user story phase depends on:

- T015-T016 depend on T010 (DTO)
- T017-T018 depend on T014 (Event Publisher - for future approval)
- T019-T020 depend on T014
- T021-T022 depend on T011 (DTO) and T014
- T023-T024 depend on T012 (DTO)
- T025-T027 depend on T013 (DTO) and Phase 1 (Storage)

### Parallel Opportunities

**Phase 1 - All can run in parallel:**

- T003, T004, T005, T006, T007, T008

**Phase 2 - All DTOs can run in parallel:**

- T010, T011, T012, T013

**Phases 3-8 - User stories can be worked in parallel after Phase 2:**

- Developer A: Phase 3 (US1)
- Developer B: Phase 4 (US2) + Phase 5 (US3)
- Developer C: Phase 6 (US4) + Phase 7 (US5)
- Developer D: Phase 8 (US6)

---

## Parallel Example: Phase 1 + Phase 2

```bash
# These can all be done simultaneously:
Task T003: Create storage config
Task T004: Create storage service
Task T005: Create storage module
Task T006: Create driver guard
Task T007: Create rider guard
Task T008: Add DRIVER_APPROVED event
Task T010: Create UpdateDriverProfileDto
Task T011: Create RegisterVehicleDto
Task T012: Create OnboardingStatusResponseDto
Task T013: Create UploadProfileImageDto
```

---

## Implementation Strategy

### MVP First (Phases 1-3 only)

1. Complete Phase 1: Schema + Storage + Guards
2. Complete Phase 2: DTOs
3. Complete Phase 3: User Story 1 (Driver Profile)
4. **TEST**: Verify PATCH /auth/driver/profile works
5. Deploy if ready

### Full Feature

1. Complete Phases 1-2 (Foundation)
2. Complete Phases 3-8 (All User Stories)
3. Complete Phase 9 (Module Registration)
4. Complete Phase 10 (Polish)
5. **TEST**: Verify all 6 endpoints work

---

## Task Count Summary

| Phase     | Task Count | Description                     |
| --------- | ---------- | ------------------------------- |
| Phase 1   | 8          | Schema, Storage, Guards, Events |
| Phase 2   | 5          | DTOs + Event Publisher          |
| Phase 3   | 2          | US1 - Driver Profile            |
| Phase 4   | 2          | US2 - Identity Documents        |
| Phase 5   | 2          | US3 - Driving License           |
| Phase 6   | 2          | US4 - Vehicle Registration      |
| Phase 7   | 2          | US5 - Onboarding Status         |
| Phase 8   | 3          | US6 - Rider Profile Image       |
| Phase 9   | 2          | Module Registration             |
| Phase 10  | 5          | Polish & Validation             |
| **Total** | **33**     |                                 |

---

## Notes

- **Code is provided** in spec documents for complex implementations
- **File paths are exact** - no ambiguity
- **Response format** is always `{success: true, data: ...}` or `{success: false, error: {code, message}}`
- **Error codes**: VALIDATION_ERROR (400), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409), PAYLOAD_TOO_LARGE (413), TOO_MANY_REQUESTS (429), SERVICE_UNAVAILABLE (503)
- **Presigned URLs** expire in 1 hour (3600 seconds)
- **Max file size**: 10MB per image
- **Allowed MIME types**: image/jpeg, image/png, image/webp
- **Retry limit**: 3 attempts per document type before admin contact required
- **Status transition**: Auto-transition to UNDER_REVIEW when all 3 document types (identity, license, vehicle) are uploaded
