# Feature Specification: Driver Registration Flow

**Feature Branch**: `006-driver-registration-flow`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "Driver flow registration with phone/OTP verification, basic info entry, identity photos, vehicle details, driving license, and car photos/uploads. Spec ensures all steps are ready for mobile app implementation."

## Clarifications

### Session 2026-03-31

- Q: Should the registration flow support resuming from where the driver left off if they close the app mid-onboarding? → A: Yes, the onboarding status endpoint must return enough information for the mobile app to determine which step to show next, including which document types are still pending.
- Q: Should driver registration require email or phone-first? → A: Phone-first via OTP is the primary authentication method. Email is still collected during registration but phone verification happens first.
- Q: Should the gateway driver proxy routes handle multipart file uploads with size limits at the gateway level? → A: Yes, the gateway should enforce the same file size limits (10MB) and reject oversized uploads before proxying to auth-service.
- Q: When should the driver's license number be collected (currently created as empty string during registration)? → A: During the driving license document upload step, alongside the 2 license images.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Phone-First Driver Registration via OTP (Priority: P1)

A prospective driver opens the mobile app and enters their phone number. The system sends a 6-digit OTP code (via SMS in production, logged to console in development with the console OTP provider using code 123456). The driver enters the code, their phone is verified, and since no account exists yet, the app prompts them to complete registration. They provide their first name, last name, email, password, and select "Driver" as their role. The system creates their User account with a Driver record in PENDING_DOCUMENTS onboarding status and returns authentication tokens so they can proceed with onboarding.

**Why this priority**: Without account creation, no other onboarding steps are possible. Phone verification is the primary authentication mechanism for mobile users and must work before anything else.

**Independent Test**: Can be fully tested by requesting an OTP for a new phone number, verifying it, then calling the registration endpoint with driver role. Verifies that tokens are returned, a Driver record is created with PENDING_DOCUMENTS status, and the user can authenticate with the returned tokens.

**Acceptance Scenarios**:

1. **Given** a new phone number not registered in the system, **When** the driver requests an OTP and verifies it with the correct code, **Then** the system returns `{ isRegistered: false, phoneNumber, uid }` indicating registration is needed.
2. **Given** a verified phone number with `isRegistered: false`, **When** the driver submits registration with first name, last name, email, password, and role=DRIVER, **Then** the system creates a User account, a Driver record with PENDING_DOCUMENTS status, and returns authentication tokens (access + refresh).
3. **Given** an already-registered phone number, **When** the driver verifies OTP, **Then** the system returns `{ isRegistered: true }` with valid authentication tokens and the existing user profile.
4. **Given** an invalid or expired OTP code, **When** the driver attempts verification, **Then** the system returns an error indicating the code is invalid or expired.
5. **Given** a driver requesting OTP more than 15 times in one minute, **When** the rate limit is exceeded, **Then** the system rejects the request with a rate limit error.

---

### User Story 2 - API Gateway Proxy for Driver Endpoints (Priority: P1)

The mobile app communicates exclusively through the API gateway. Currently, all driver onboarding endpoints (`/auth/driver/*`) exist only in the auth-service and are unreachable through the gateway. The gateway must proxy driver-related requests — including multipart file uploads for documents and vehicle images — to the auth-service, forwarding authentication tokens and preserving the request body intact.

**Why this priority**: Without gateway proxy routes, the mobile app cannot reach any driver onboarding endpoint. This is a blocking infrastructure gap that prevents all other driver stories from functioning through the gateway.

**Independent Test**: Can be fully tested by sending a request to `/auth/driver/onboarding-status` through the gateway with a valid driver JWT and verifying the response matches what the auth-service returns directly.

**Acceptance Scenarios**:

1. **Given** an authenticated driver, **When** they send GET `/auth/driver/onboarding-status` through the gateway, **Then** the gateway proxies the request to auth-service and returns the onboarding status response.
2. **Given** an authenticated driver, **When** they upload 3 identity images via POST `/auth/driver/documents/identity` through the gateway, **Then** the gateway forwards the multipart request to auth-service preserving all files and the authorization header.
3. **Given** an unauthenticated request to any `/auth/driver/*` endpoint, **When** it reaches the gateway, **Then** the gateway returns a 401 Unauthorized error without proxying to auth-service.
4. **Given** a request with a file exceeding 10MB, **When** it reaches the gateway, **Then** the gateway rejects the request before forwarding to auth-service.

---

### User Story 3 - Driver Profile Completion (Priority: P1)

After registration, the driver needs to fill in additional personal details required for verification: address, city, state, country, date of birth, emergency contact name, and emergency contact phone. These non-critical fields can also be updated after onboarding approval, but they are part of the initial onboarding flow shown to new drivers.

**Why this priority**: Profile completion is typically the first screen shown after registration in the mobile app. It collects necessary information for background checks and emergency situations.

**Independent Test**: Can be fully tested by updating a new driver's profile via PATCH with valid data and verifying the response contains the updated fields.

**Acceptance Scenarios**:

1. **Given** a newly registered driver with incomplete profile, **When** they submit PATCH `/auth/driver/profile` with address, emergency contact, and date of birth, **Then** the profile is updated and the response reflects all changes.
2. **Given** a non-driver user (rider or admin), **When** they attempt PATCH `/auth/driver/profile`, **Then** the system returns 403 Forbidden.
3. **Given** a driver submitting an invalid date format for date of birth, **When** the request reaches the server, **Then** the system returns 400 with a validation error message.

---

### User Story 4 - Identity Document Upload (Priority: P2)

The driver uploads identity verification documents — exactly 3 images (typically front of ID, back of ID, and a selfie holding the ID). Each image is validated for format (JPEG, PNG, WebP) and size (max 10MB), stored in object storage under a driver-specific path, and the storage keys are recorded in the database. Presigned URLs are returned for the mobile app to display the uploaded images. The system tracks upload attempts and enforces a maximum of 3 attempts for identity documents.

**Why this priority**: Identity verification is legally required for drivers to operate on the platform. Without it, the driver cannot be approved.

**Independent Test**: Can be fully tested by uploading 3 identity images for a driver and verifying that storage keys are persisted, presigned URLs are returned, and the onboarding status reflects progress.

**Acceptance Scenarios**:

1. **Given** an authenticated driver with PENDING_DOCUMENTS status, **When** they upload exactly 3 valid identity images via POST `/auth/driver/documents/identity`, **Then** images are stored under the driver's identity path, database records are created, and presigned URLs are returned.
2. **Given** a driver uploading identity documents, **When** fewer than 3 or more than 3 images are provided, **Then** the system returns 400 indicating exactly 3 images are required.
3. **Given** a driver uploading identity documents, **When** a file has an unsupported type, **Then** the system returns 415 listing accepted formats (JPEG, PNG, WebP).
4. **Given** a driver who has reached 3 upload attempts for identity documents, **When** they attempt to upload again, **Then** the system returns 429 Too Many Requests.

---

### User Story 5 - Driving License Upload (Priority: P2)

The driver submits their driving license number and uploads their driving license for verification — exactly 2 images (front and back of the license). The license number is saved to the Driver record at this point (replacing the empty placeholder from registration). Images are validated, stored in object storage under the driver's license path, and the storage keys are recorded alongside the identity documents in the DriverDocument record. Presigned URLs are returned for mobile display. Upload attempt tracking and the 3-attempt limit apply separately from identity documents.

**Why this priority**: Driving license verification is mandatory for legal compliance. A driver cannot be approved without a verified license. Collecting the license number here is the natural UX moment since the driver already has their license in hand.

**Independent Test**: Can be fully tested by uploading 2 driving license images via POST `/auth/driver/documents/driving-license` and verifying storage, database persistence, and URL generation.

**Acceptance Scenarios**:

1. **Given** an authenticated driver, **When** they submit POST `/auth/driver/documents/driving-license` with a valid license number and exactly 2 valid images, **Then** the license number is saved to the Driver record, images are stored, the DriverDocument record is updated, and presigned URLs are returned.
2. **Given** a driver submitting a license number, **When** the license number is already registered to another driver, **Then** the system returns 409 Conflict indicating the license number is already in use.
3. **Given** a driver uploading license documents, **When** an image exceeds 10MB, **Then** the system returns 413 with size limit information.
4. **Given** a driver uploading license documents, **When** fewer than 2 or more than 2 images are provided, **Then** the system returns 400 indicating exactly 2 images are required.
5. **Given** a driver uploading license documents, **When** the license number is missing from the request, **Then** the system returns 400 indicating the license number is required.

---

### User Story 6 - Vehicle Registration (Priority: P2)

The driver registers their vehicle by providing make, model, year, color, plate number, a photo of the car, and an image of the vehicle registration/license document. The system validates the plate number format (two or three uppercase letters, a hyphen, then four digits), validates the vehicle year range, stores both images in object storage under the driver's vehicle path, and creates or updates a Vehicle record linked to the driver.

**Why this priority**: Vehicle registration is essential for rider safety and platform compliance. Drivers cannot be approved without a registered vehicle.

**Independent Test**: Can be fully tested by submitting vehicle details and images via POST `/auth/driver/vehicle` and verifying the vehicle record is created, linked to the driver, and all images are stored with accessible presigned URLs.

**Acceptance Scenarios**:

1. **Given** an authenticated driver who has not registered a vehicle, **When** they submit POST `/auth/driver/vehicle` with valid vehicle details, car image, and license image, **Then** a Vehicle record is created, linked to the driver, and presigned URLs for both images are returned.
2. **Given** a driver registering a vehicle, **When** the plate number does not match the expected format, **Then** the system returns 400 with format requirements.
3. **Given** a driver registering a vehicle, **When** the vehicle year is outside the allowed range (current year minus 20 to current year plus 1), **Then** the system returns 400 indicating valid year boundaries.
4. **Given** a driver who already has a registered vehicle, **When** they submit vehicle registration again, **Then** the existing vehicle record is updated with the new information and images.

---

### User Story 7 - Onboarding Status and Progress Tracking (Priority: P2)

Throughout the onboarding process, the driver and the mobile app need to check which steps are complete and which remain. The system returns the overall onboarding status (PENDING_DOCUMENTS, UNDER_REVIEW, APPROVED, REJECTED) along with detailed per-document status including presigned URLs for preview, upload attempt counts, and rejection reasons if applicable. When all three document types (identity, license, vehicle) are uploaded, the system automatically transitions the driver to UNDER_REVIEW status. This enables the mobile app to determine which screen to show the driver at any point.

**Why this priority**: The mobile app relies on this endpoint to determine which screen to show the driver. Without accurate status tracking, drivers cannot navigate the onboarding flow.

**Independent Test**: Can be fully tested by calling GET `/auth/driver/onboarding-status` at various stages and verifying the response accurately reflects the completion state of each document type.

**Acceptance Scenarios**:

1. **Given** a newly registered driver, **When** they check onboarding status, **Then** the response shows PENDING_DOCUMENTS with all document types showing zero uploads and no images.
2. **Given** a driver who has uploaded identity and license documents but not registered a vehicle, **When** they check onboarding status, **Then** the response shows PENDING_DOCUMENTS with identity and license marked as having images, and vehicle status as pending with no images.
3. **Given** a driver who has uploaded all document types (identity, license, vehicle), **When** the last upload completes, **Then** the onboarding status automatically transitions to UNDER_REVIEW.
4. **Given** a driver whose documents were rejected with reasons, **When** they check onboarding status, **Then** the response includes rejection reasons for each failed document type and shows status as PENDING_DOCUMENTS.
5. **Given** a driver with uploaded documents, **When** they check onboarding status, **Then** all uploaded images are accessible via fresh presigned URLs valid for 1 hour.

---

### User Story 8 - Driver Online Status Toggle (Priority: P3)

An approved driver can toggle their availability to indicate they are ready to accept ride requests. Only drivers with APPROVED onboarding status can go online. Drivers still in the onboarding process receive a clear error if they attempt to go online.

**Why this priority**: This enables drivers to start earning after approval. It is not needed during onboarding itself, but is the gateway to trip matching.

**Independent Test**: Can be fully tested by toggling an approved driver's online status and verifying the change persists.

**Acceptance Scenarios**:

1. **Given** an approved driver, **When** they set their status to online via PATCH `/auth/driver/status`, **Then** the system updates the driver's online status and returns the updated record.
2. **Given** a driver with PENDING_DOCUMENTS status, **When** they attempt to go online, **Then** the system returns 400 with a message indicating only approved drivers can go online and showing the current status.

---

### Edge Cases

| Edge Case                                                  | Handling Strategy                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Driver drops off mid-registration and returns later        | Progress is persisted; onboarding status endpoint tells the app which step to show                           |
| Gateway multipart proxy drops large files                  | Gateway enforces 10MB limit; oversized requests rejected before proxy                                        |
| OTP verification succeeds but registration fails           | Mobile app re-prompts registration; OTP verification is repeatable                                           |
| Concurrent document uploads from the same driver           | Last write wins via upsert; upload attempt counter incremented atomically                                    |
| Object storage temporarily unavailable during upload       | Returns 503 Service Unavailable; driver can retry                                                            |
| Driver account suspended during onboarding review          | Documents remain in review; admin panel shows suspended status alongside review                              |
| Expired presigned URLs when driver views documents         | Mobile app re-fetches onboarding status to get fresh presigned URLs                                          |
| Vehicle plate number already registered to another driver  | Returns 409 Conflict indicating plate number is already in use                                               |
| Driver re-registers with same phone after account deletion | Treated as new user if no User record exists; otherwise returns existing account                             |
| Resubmission after document rejection                      | Status reverts to PENDING_DOCUMENTS; only rejected document types can be re-uploaded, up to 3 attempts total |
| Maximum upload attempts exceeded                           | Returns 429; driver must contact admin support to reset                                                      |

## Requirements _(mandatory)_

### Functional Requirements

**Phone Verification**

- **FR-001**: System MUST provide a phone verification flow where the driver requests a 6-digit OTP code sent to their phone number
- **FR-002**: System MUST verify the OTP code and return whether the phone number is associated with an existing account
- **FR-003**: System MUST return authentication tokens for verified phones with existing accounts, enabling immediate login without password
- **FR-004**: System MUST return a flag indicating registration is needed for verified phones without accounts
- **FR-005**: System MUST rate-limit OTP requests to 15 per minute per IP address

**Account Registration**

- **FR-006**: System MUST allow new drivers to register after phone verification by providing first name, last name, email, password, and phone number with role=DRIVER
- **FR-007**: System MUST create a Driver record with PENDING_DOCUMENTS onboarding status upon driver registration
- **FR-008**: System MUST return authentication tokens (access + refresh) upon successful registration
- **FR-009**: System MUST prevent duplicate registrations with the same email or phone number, returning specific conflict messages for each

**API Gateway Proxy Routes**

- **FR-010**: System MUST proxy all driver onboarding endpoints through the API gateway, including: profile update, document uploads, vehicle registration, online status, and onboarding status
- **FR-011**: System MUST forward authentication tokens (Bearer header) from mobile requests through the gateway to auth-service
- **FR-012**: System MUST proxy multipart file upload requests preserving the original content type and body
- **FR-013**: System MUST enforce file size limits (10MB total request size) at the gateway level before proxying to auth-service
- **FR-014**: System MUST return appropriate error responses (401, 403, 400, 413, 429, etc.) from auth-service through the gateway

**Driver Profile Management**

- **FR-015**: System MUST allow authenticated drivers to update non-critical profile fields (address, city, state, country, date of birth, emergency contact name, emergency contact phone)
- **FR-016**: System MUST restrict driver endpoints to users with DRIVER role, returning 403 for other roles
- **FR-017**: System MUST allow profile updates even after onboarding is APPROVED

**Document Uploads**

- **FR-018**: System MUST accept exactly 3 identity verification images in JPEG, PNG, or WebP format, each under 10MB
- **FR-019**: System MUST accept a driving license number and exactly 2 driving license images in JPEG, PNG, or WebP format, each under 10MB; the license number MUST be saved to the Driver record, replacing the empty placeholder from registration
- **FR-019a**: System MUST reject duplicate license numbers with 409 Conflict (error code `LICENSE_NUMBER_ALREADY_REGISTERED`) if the number is already registered to another driver
- **FR-020**: System MUST store document images under driver-specific paths and return presigned URLs with 1-hour expiration for viewing
- **FR-021**: System MUST track upload attempts per document type and limit to 3 total attempts per type
- **FR-022**: System MUST return 429 when upload attempt limit is exceeded, requiring driver to contact admin support

**Vehicle Registration**

- **FR-023**: System MUST allow drivers to register a vehicle with make, model, year, color, plate number, car image, and license image
- **FR-024**: System MUST validate plate number format (two or three uppercase letters, hyphen, four digits) and vehicle year range (current year minus 20 to current year plus 1)
- **FR-025**: System MUST create or update the vehicle record and link it to the driver
- **FR-026**: System MUST store vehicle images and return presigned URLs for both car and license images
- **FR-026a**: System MUST reject duplicate vehicle plate numbers with 409 Conflict if the plate is already registered to another driver

**Onboarding Status**

- **FR-027**: System MUST provide an onboarding status endpoint returning overall status and per-document details including presigned URLs, statuses, attempt counts, and rejection reasons
- **FR-028**: System MUST automatically transition from PENDING_DOCUMENTS to UNDER_REVIEW when all three document types (identity, license, vehicle) have been uploaded
- **FR-029**: System MUST revert to PENDING_DOCUMENTS when documents are rejected, with rejection reasons visible per document type
- **FR-030**: System MUST restrict online status toggling to drivers with APPROVED onboarding status only

### Key Entities

- **User**: Core account entity. Key attributes: first name, last name, email, phone number, password, role (DRIVER/RIDER/ADMIN/SUPPORT), status, profile image, address fields, date of birth, emergency contacts. Created during registration after OTP verification.

- **Driver**: Driver-specific profile linked one-to-one with User. Key attributes: license number, onboarding status (PENDING_DOCUMENTS → UNDER_REVIEW → APPROVED/REJECTED), online status, rating, total trips, linked vehicle reference.

- **DriverDocument**: Document package for a driver (one-to-one with Driver). Contains arrays of image storage keys for identity (3 images) and driving license (2 images), per-document statuses (PENDING/APPROVED/REJECTED), upload attempt counters, and rejection reasons.

- **Vehicle**: Vehicle registered by a driver. Key attributes: make, model, year, color, plate number (unique), car image, license image, approval status, rejection reason, upload attempt counter. Referenced by Driver via vehicleId.

- **Onboarding Status Response**: Composite view returned to the mobile app containing overall onboarding status plus detailed per-document information (identity, driving license, vehicle) with presigned image URLs, statuses, attempt counts, and rejection reasons.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A new driver can complete the full registration flow (phone verification through all document uploads) in under 10 minutes _(manual QA criterion)_
- **SC-002**: Every driver onboarding endpoint is reachable through the API gateway, with responses consistent with direct auth-service access
- **SC-003**: Uploaded document images are retrievable via presigned URLs within 2 seconds of request, valid for 1 hour
- **SC-004**: Onboarding status endpoint returns accurate state reflecting all completed and pending steps, enabling the mobile app to show the correct screen
- **SC-005**: 100% of unauthorized access attempts to driver endpoints are blocked with appropriate error codes (401 for unauthenticated, 403 for wrong role)
- **SC-006**: The system correctly auto-transitions to UNDER_REVIEW within 1 second of all three document categories being submitted
- **SC-007**: A driver who abandons registration mid-way can resume from their last completed step upon return, with all progress preserved

## Assumptions

- The mobile app handles image compression before upload (server does not compress images)
- OTP delivery in development uses the console provider with fixed code 123456; production uses a real SMS provider
- The mobile app uses `x-client-type: mobile` header to receive tokens in response body rather than httpOnly cookies
- Admin panel for reviewing and approving/rejecting driver documents is handled separately (out of scope for this spec)
- Object storage (MinIO) bucket "ain-rider" is already provisioned and accessible
- JWT authentication and role extraction already work in both auth-service and the API gateway
- The existing auth-service Driver Onboarding module (spec 005) is fully implemented and functional
- NATS event publishing for driver approval already exists and is functional
- The existing registration endpoint creates a Driver shell record with empty licenseNumber; the license number is collected during the driving license document upload step (User Story 5)
- Field length limits follow reasonable defaults (names up to 100 characters, email up to 255 characters, phone 8-15 characters, password minimum 6 characters)
- The mobile app will determine which onboarding screen to display based on the onboarding status response alone, without additional API calls
