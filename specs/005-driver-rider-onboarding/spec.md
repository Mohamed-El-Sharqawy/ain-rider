# Feature Specification: Driver & Rider Onboarding

**Feature Branch**: `005-driver-rider-onboarding`  
**Created**: 2026-03-28  
**Status**: Draft  
**Input**: User description: "Driver and rider onboarding endpoints in auth-service with document uploads to MinIO, vehicle registration, and onboarding status tracking"

## Clarifications

### Session 2026-03-28

- Q: What triggers the transition from PENDING_DOCUMENTS to UNDER_REVIEW status? → A: Automatic when all 3 document types uploaded (identity, license, vehicle)
- Q: When documents are rejected, what happens to the driver's onboarding status and can they resubmit? → A: Status reverts to PENDING_DOCUMENTS, driver can resubmit rejected documents only
- Q: Should drivers be able to update profile fields AFTER onboarding is complete (APPROVED status)? → A: Yes, but only non-critical fields (address, emergency contact); phone/email changes require separate verification
- Q: What is the maximum number of retry attempts for document uploads after rejection? → A: 3 attempts per document type, then requires admin review/contact
- Q: Should uploaded document images be accessible to drivers after upload (e.g., to preview/verify what was submitted)? → A: Yes - via presigned URLs with 1-hour expiration for secure viewing

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Driver Profile Completion (Priority: P1)

A newly registered driver needs to complete their profile with additional personal details that weren't collected during initial registration. The driver opens the mobile app, navigates to the profile section, and fills in any missing information such as emergency contact, address, or other required fields. The system saves these updates and advances the driver's onboarding status.

**Why this priority**: Profile completion is the first step in onboarding and is required before any document uploads can proceed. Without basic profile data, the driver cannot move forward in the onboarding flow.

**Independent Test**: Can be fully tested by registering a new driver account and calling PATCH /auth/driver/profile with missing fields. Verifies that fields are persisted and onboarding status reflects progress.

**Acceptance Scenarios**:

1. **Given** a driver with incomplete profile fields, **When** they submit PATCH /auth/driver/profile with valid data, **Then** the profile is updated and a success response is returned with the updated profile.
2. **Given** a driver attempting to update profile, **When** the request contains invalid data (e.g., invalid email format), **Then** the system returns a 400 error with specific validation messages.
3. **Given** a non-driver user (rider or admin), **When** they attempt to access PATCH /auth/driver/profile, **Then** the system returns a 403 Forbidden error.

---

### User Story 2 - Driver Identity Document Upload (Priority: P1)

A driver needs to upload identity verification documents (typically 3 images: front of ID, back of ID, and a selfie holding the ID). The driver selects images from their device gallery or takes photos, and the system uploads them to secure storage, stores the references in the database, and advances the onboarding status.

**Why this priority**: Identity verification is legally required for drivers to operate on the platform. Without it, the driver cannot be approved to accept rides.

**Independent Test**: Can be fully tested by uploading 3 identity images via POST /auth/driver/documents/identity and verifying that images are stored in MinIO, keys are saved to the database, and the response includes full URLs to access the images.

**Acceptance Scenarios**:

1. **Given** an authenticated driver with DRIVER role, **When** they submit POST /auth/driver/documents/identity with exactly 3 valid image files, **Then** images are uploaded to MinIO under drivers/{userId}/identity/, database records are created with the storage keys, and full URLs are returned.
2. **Given** a driver uploading identity documents, **When** fewer than 3 or more than 3 images are provided, **Then** the system returns a 400 error indicating exactly 3 images are required.
3. **Given** a driver uploading identity documents, **When** a file is not a valid image type (jpg, png, webp), **Then** the system returns a 400 error listing acceptable formats.
4. **Given** a driver who has already uploaded identity documents, **When** they attempt to upload again, **Then** the system returns a 409 Conflict error indicating documents already exist.

---

### User Story 3 - Driver Driving License Upload (Priority: P1)

A driver needs to upload their driving license for verification (typically 2 images: front and back of the license). The driver captures or selects these images, and the system stores them securely and tracks the document status.

**Why this priority**: Driving license verification is mandatory for legal compliance. A driver cannot be approved without a verified license.

**Independent Test**: Can be fully tested by uploading 2 driving license images via POST /auth/driver/documents/driving-license and verifying storage in MinIO, database persistence, and URL generation.

**Acceptance Scenarios**:

1. **Given** an authenticated driver, **When** they submit POST /auth/driver/documents/driving-license with exactly 2 valid image files, **Then** images are uploaded to MinIO under drivers/{userId}/driving-license/, database records are updated, and full URLs are returned.
2. **Given** a driver uploading license documents, **When** an image exceeds the maximum file size (10MB), **Then** the system returns a 413 error with size limit information.

---

### User Story 4 - Driver Vehicle Registration (Priority: P2)

A driver needs to register their vehicle with detailed information including make, model, year, color, plate number, a photo of the car, and images of the vehicle registration/license document. The system creates a vehicle record linked to the driver and stores all associated images.

**Why this priority**: Vehicle registration is essential for rider safety and platform compliance, but can be completed after identity documents since a driver's vehicle situation may change during onboarding.

**Independent Test**: Can be fully tested by submitting vehicle details and images via POST /auth/driver/vehicle and verifying the vehicle record is created, linked to the driver, and all images are stored with accessible URLs.

**Acceptance Scenarios**:

1. **Given** an authenticated driver who has completed identity verification, **When** they submit POST /auth/driver/vehicle with car info (make, model, year, color, plateNumber), car image, and car license image, **Then** a vehicle record is created, images are stored in MinIO under drivers/{userId}/vehicle/, and the driver's vehicleId is updated.
2. **Given** a driver registering a vehicle, **When** the plate number format does not match `[A-Z]{2,3}-[0-9]{4}`, **Then** the system returns a 400 error with format requirements.
3. **Given** a driver who already has a registered vehicle, **When** they attempt to register another vehicle, **Then** the existing vehicle record is updated (replacement) and a warning is logged.

---

### User Story 5 - Driver Onboarding Status Check (Priority: P2)

A driver or the mobile app needs to check the current status of the onboarding process to determine what steps remain. The system returns the current step, completed steps, and overall status (pending documents, under review, approved, rejected).

**Why this priority**: Critical for mobile app navigation - the app needs to know where the driver is in the process to show the appropriate screen and prompt the right actions.

**Independent Test**: Can be fully tested by calling GET /auth/driver/onboarding-status at various stages of onboarding and verifying the response accurately reflects completion state.

**Acceptance Scenarios**:

1. **Given** a newly registered driver, **When** they call GET /auth/driver/onboarding-status, **Then** the response shows status PENDING_DOCUMENTS with all document types marked as incomplete.
2. **Given** a driver who has uploaded all required documents (identity, license, vehicle), **When** the final document upload completes, **Then** the system automatically transitions status to UNDER_REVIEW and subsequent GET /auth/driver/onboarding-status shows this status with all document types marked as pending review.
3. **Given** an admin-approved driver, **When** they call GET /auth/driver/onboarding-status, **Then** the response shows status APPROVED and includes the driver.approved event timestamp.
4. **Given** a driver whose documents were rejected, **When** they call GET /auth/driver/onboarding-status, **Then** the response shows status REJECTED with rejection reasons for each failed document.

---

### User Story 6 - Rider Profile Image Upload (Priority: P3)

A rider wants to personalize their profile by uploading a profile picture. The rider selects an image, the system uploads it to secure storage, and updates the rider's profile with the new image URL.

**Why this priority**: Profile images enhance the user experience and trust between riders and drivers, but are not essential for core functionality. Riders can use the platform without a profile image.

**Independent Test**: Can be fully tested by uploading a profile image via PATCH /auth/rider/profile/image and verifying the User model's profileImage field is updated with the MinIO URL.

**Acceptance Scenarios**:

1. **Given** an authenticated rider, **When** they submit PATCH /auth/rider/profile/image with a valid image file, **Then** the image is uploaded to MinIO under riders/{userId}/profile/, the User profileImage field is updated, and the full URL is returned.
2. **Given** a rider uploading a profile image, **When** the image dimensions are below minimum requirements (100x100), **Then** the system returns a 400 error suggesting acceptable dimensions.
3. **Given** a rider with an existing profile image, **When** they upload a new image, **Then** the old image is deleted from storage and replaced with the new one.

---

### Edge Cases

> **Scope Note**: Edge cases below are documented for awareness. Unless explicitly covered by a functional requirement, these are considered **out-of-scope for MVP** and should be addressed in future iterations.

| Edge Case                                           | MVP Handling                                                                | Future Consideration                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| MinIO storage temporarily unavailable during upload | Returns 503 Service Unavailable; driver can retry                           | Add retry queue with exponential backoff  |
| Concurrent document uploads from same driver        | Last write wins (Prisma upsert); no locking                                 | Add optimistic locking with version field |
| Driver account suspended during review              | Documents remain in review; admin sees suspended status                     | Auto-reject on suspension                 |
| Corrupted images or spoofed MIME types              | MIME validated via magic bytes (not extension)                              | Add image processing/validation service   |
| Resubmission after rejection                        | Status reverts to PENDING_DOCUMENTS; only rejected types can be resubmitted | ✅ Implemented (FR-010a, FR-016b)         |
| Vehicle record deleted but vehicleId exists         | Returns 404 on status check; driver can re-register                         | Add orphan cleanup job                    |
| Retry limit exceeded                                | Returns 429; requires admin contact                                         | Admin panel reset feature                 |

## Requirements _(mandatory)_

### Functional Requirements

**Driver Profile Management**

- **FR-001**: System MUST allow authenticated drivers to update profile fields via PATCH /auth/driver/profile
- **FR-001a**: System MUST restrict critical fields (phone, email) from direct update - these require separate verification flow
- **FR-001b**: System MUST allow updates to non-critical fields (address, emergency contact) even after APPROVED status
- **FR-002**: System MUST validate all profile field updates against defined constraints (length, format, required fields)
- **FR-003**: System MUST restrict /auth/driver/\* endpoints to users with DRIVER role via DriverGuard

**Driver Document Upload**

- **FR-004**: System MUST accept exactly 3 identity verification images via POST /auth/driver/documents/identity
- **FR-005**: System MUST accept exactly 2 driving license images via POST /auth/driver/documents/driving-license
- **FR-006**: System MUST store all driver documents in MinIO bucket "ain-rider" under paths drivers/{userId}/identity/ and drivers/{userId}/driving-license/
- **FR-007**: System MUST return full MinIO object URLs in all upload responses for mobile app display
- **FR-007a**: System MUST provide presigned GET URLs with 1-hour expiration for document image access (identity, license, vehicle)
- **FR-007b**: System MUST include presigned URLs in onboarding-status response so drivers can preview submitted documents
- **FR-008**: System MUST persist document storage keys in the DriverDocument model with per-document status
- **FR-009**: System MUST validate image file types (jpg, png, webp) and enforce maximum file size (10MB)
- **FR-010**: System MUST prevent duplicate document uploads while in PENDING status (return 409 Conflict if documents already exist and are not rejected); after rejection, driver MAY re-upload up to the retry limit
- **FR-010a**: System MUST allow resubmission when document status is REJECTED, tracking upload attempt count per document type and limiting to 3 attempts total (initial + 2 retries)
- **FR-010b**: System MUST return 429 Too Many Requests when retry limit (3 attempts) is exceeded, requiring driver to contact admin support

**Vehicle Registration**

- **FR-011**: System MUST allow drivers to register a vehicle via POST /auth/driver/vehicle with make, model, year, color, plateNumber (validated against `[A-Z]{2,3}-[0-9]{4}`), carImage, carLicenseImage, and optional carLicenseText
- **FR-012**: System MUST store vehicle images in MinIO under drivers/{userId}/vehicle/
- **FR-013**: System MUST create a Vehicle record and link it to the Driver via vehicleId
- **FR-014**: System MUST validate vehicle year is within range `(currentYear - 20)` to `(currentYear + 1)` (e.g., in 2026: valid years are 2006-2027)

**Onboarding Status**

- **FR-015**: System MUST provide GET /auth/driver/onboarding-status returning current step and overall status
- **FR-016**: System MUST track onboarding status as enum: PENDING_DOCUMENTS, UNDER_REVIEW, APPROVED, REJECTED
- **FR-016a**: System MUST automatically transition status from PENDING_DOCUMENTS to UNDER_REVIEW when all 3 document types are uploaded (identity, driving license, vehicle)
- **FR-016b**: System MUST revert status to PENDING_DOCUMENTS when documents are rejected, allowing driver to resubmit only the rejected document types
- **FR-017**: System MUST include completion status for each document type in the status response

**Driver Approval Event**

- **FR-018**: System MUST publish "driver.approved" event to NATS JetStream when driver status changes to APPROVED
- **FR-019**: The event payload MUST conform to `DriverApprovedEvent` interface:
  ```typescript
  interface DriverApprovedEvent {
    subject: "ain_rider.driver.approved";
    data: {
      driverId: string; // UUID of the Driver record
      userId: string; // UUID of the User account
      vehicleId: string; // UUID of the linked Vehicle
      approvedAt: string; // ISO 8601 timestamp
    };
  }
  ```

**Rider Profile Image**

- **FR-020**: System MUST allow authenticated riders to upload profile image via PATCH /auth/rider/profile/image
- **FR-021**: System MUST restrict /auth/rider/\* endpoints to users with RIDER role via RiderGuard
- **FR-022**: System MUST store rider profile images in MinIO under riders/{userId}/profile/
- **FR-023**: System MUST update the User model's profileImage field with the full MinIO URL
- **FR-024**: System MUST delete previous profile image when a new one is uploaded

**Data Model**

- **FR-025**: System MUST remove isOnline field from Driver model (isOnline lives in Redis only, managed by location-service)
- **FR-026**: System MUST add DriverDocument model with identityImages (String[]), drivingLicenseImages (String[]), identityStatus, drivingLicenseStatus, and rejection reasons
- **FR-027**: System MUST add Vehicle model with carImage, carLicenseImage, carLicenseText, make, model, year, plateNumber, color
- **FR-028**: System MUST add onboardingStatus field to Driver model with enum values

### Key Entities

- **DriverDocument**: Stores identity and driving license document references for a driver. Contains arrays of MinIO object keys for images, status fields for each document type (PENDING, APPROVED, REJECTED), optional rejection reasons, and timestamps. Linked one-to-one with Driver. Images are accessed via presigned URLs (1-hour expiration) for security.

- **Vehicle**: Stores vehicle information registered by a driver. Contains car details (make, model, year, color, plate number), MinIO keys for car image and license image, optional OCR-extracted license text. Linked to Driver via vehicleId field on Driver model.

- **Driver (extended)**: Extended to include onboardingStatus (PENDING_DOCUMENTS, UNDER_REVIEW, APPROVED, REJECTED) tracking the overall onboarding progress. The isOnline field is removed as online status is managed in Redis by location-service.

- **User (extended)**: The profileImage field stores the full MinIO URL for rider profile images.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Drivers can complete the entire document upload flow (identity + license + vehicle) in under 10 minutes on average
- **SC-002**: Image uploads complete within 5 seconds for files up to 10MB on standard mobile connections
- **SC-003**: 100% of uploaded documents are retrievable via the returned URLs within 24 hours of upload
- **SC-004**: Onboarding status endpoint returns accurate state within 500ms
- **SC-005**: Driver approval events are published to NATS within 1 second of status change
- **SC-006**: Zero unauthorized access to driver or rider endpoints (all blocked by appropriate guards)
- **SC-007**: Profile image upload success rate above 99% for valid image submissions

## Assumptions

- Mobile app handles image compression before upload (server does not compress)
- Admin panel for reviewing/approving documents is handled separately (not part of this feature)
- OCR for car license text is optional and can be added later without schema changes
- MinIO bucket "ain-rider" already exists or will be created by infrastructure
- Existing NatsService in auth-service can be reused for event publishing
- MinIO configuration (endpoint, credentials) can be shared from admin-service pattern
- Driver and Rider records are already created during registration (per current flow)
- JWT authentication and user role extraction already work in JwtAuthGuard
- NATS JetStream stream for driver events will be added to existing AIN_RIDER_AUTH stream
- File type validation uses MIME type inspection, not just file extension

## Missing/Incomplete Items Flagged

1. **MinIO client in auth-service**: No storage service exists in auth-service. Need to create StorageService/StorageModule following the admin-service pattern, or extract to a shared package.

2. **DriverGuard and RiderGuard**: No role-based guards exist. Need to create guards that check user.role === 'DRIVER' or 'RIDER' after JWT authentication.

3. **NATS subject for driver.approved**: The shared-types NATS_SUBJECTS does not include DRIVER_APPROVED. Need to add this subject to the shared-types package.

4. **Admin document review endpoints**: Not included in this feature - assumed to be handled separately in admin-service.

5. **Document resubmission after rejection**: Flow exists (driver can re-upload) but rejection notification mechanism is not specified.
