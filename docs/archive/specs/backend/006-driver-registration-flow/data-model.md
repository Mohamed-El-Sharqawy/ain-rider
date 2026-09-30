# Data Model: Driver Registration Flow

**Branch**: `006-driver-registration-flow` | **Date**: 2026-03-31

## Existing Schema (No Changes Required)

The Prisma schema at `apps/nest/auth-service/prisma/schema.prisma` already contains all entities needed for this feature. No schema migrations are required.

## Entities

### User (`users` table)

| Field                 | Type      | Constraints          | Notes                      |
| --------------------- | --------- | -------------------- | -------------------------- |
| id                    | String    | @id @default(uuid()) | Primary key                |
| email                 | String    | @unique              | Required                   |
| phoneNumber           | String    | @unique              | E.164 format (8-15 chars)  |
| passwordHash          | String    |                      | bcrypt hashed              |
| firstName             | String    |                      | Required                   |
| lastName              | String    |                      | Required                   |
| role                  | String    |                      | DRIVER/RIDER/ADMIN/SUPPORT |
| status                | String    | @default("ACTIVE")   |                            |
| profileImage          | String?   |                      | MinIO object key           |
| address               | String?   |                      |                            |
| city                  | String?   |                      |                            |
| state                 | String?   |                      |                            |
| country               | String?   |                      |                            |
| dateOfBirth           | DateTime? |                      |                            |
| emergencyContactName  | String?   |                      |                            |
| emergencyContactPhone | String?   |                      |                            |
| createdAt             | DateTime  | @default(now())      |                            |
| updatedAt             | DateTime  | @updatedAt           |                            |

**Relations**: has one Driver?, has one Rider?, has many RefreshToken[]

### Driver (`drivers` table)

| Field            | Type             | Constraints                 | Notes                                                   |
| ---------------- | ---------------- | --------------------------- | ------------------------------------------------------- |
| id               | String           | @id @default(uuid())        | Primary key                                             |
| userId           | String           | @unique                     | FK → User.id (cascade delete)                           |
| vehicleId        | String?          |                             | FK → Vehicle.id (set null on delete)                    |
| licenseNumber    | String           | @unique                     | Initially empty string; populated during license upload |
| rating           | Float            | @default(5.0)               |                                                         |
| totalTrips       | Int              | @default(0)                 |                                                         |
| onboardingStatus | OnboardingStatus | @default(PENDING_DOCUMENTS) |                                                         |
| isOnline         | Boolean          | @default(false)             |                                                         |
| createdAt        | DateTime         | @default(now())             |                                                         |
| updatedAt        | DateTime         | @updatedAt                  |                                                         |

**Relations**: belongs to User, has one Vehicle?, has one DriverDocument?

### DriverDocument (`driver_documents` table)

| Field                         | Type           | Constraints          | Notes                           |
| ----------------------------- | -------------- | -------------------- | ------------------------------- |
| id                            | String         | @id @default(uuid()) | Primary key                     |
| driverId                      | String         | @unique              | FK → Driver.id (cascade delete) |
| identityImages                | String[]       |                      | MinIO object keys (3 entries)   |
| identityStatus                | DocumentStatus | @default(PENDING)    |                                 |
| identityRejectionReason       | String?        |                      |                                 |
| identityUploadAttempts        | Int            | @default(0)          | Max 3                           |
| drivingLicenseImages          | String[]       |                      | MinIO object keys (2 entries)   |
| drivingLicenseStatus          | DocumentStatus | @default(PENDING)    |                                 |
| drivingLicenseRejectionReason | String?        |                      |                                 |
| drivingLicenseUploadAttempts  | Int            | @default(0)          | Max 3                           |
| createdAt                     | DateTime       | @default(now())      |                                 |
| updatedAt                     | DateTime       | @updatedAt           |                                 |

**Indexes**: `[identityStatus]`, `[drivingLicenseStatus]`

**Relations**: belongs to Driver (one-to-one)

### Vehicle (`vehicles` table)

| Field           | Type           | Constraints          | Notes                           |
| --------------- | -------------- | -------------------- | ------------------------------- |
| id              | String         | @id @default(uuid()) | Primary key                     |
| make            | String         |                      | Required                        |
| model           | String         |                      | Required                        |
| year            | Int            |                      | currentYear-20 to currentYear+1 |
| color           | String         |                      | Required                        |
| plateNumber     | String         | @unique              | Format: [A-Z]{2,3}-[0-9]{4}     |
| carImage        | String         |                      | MinIO object key                |
| carLicenseImage | String         |                      | MinIO object key                |
| carLicenseText  | String?        |                      | OCR-extracted text (optional)   |
| status          | DocumentStatus | @default(PENDING)    |                                 |
| rejectionReason | String?        |                      |                                 |
| uploadAttempts  | Int            | @default(0)          | Max 3                           |
| createdAt       | DateTime       | @default(now())      |                                 |
| updatedAt       | DateTime       | @updatedAt           |                                 |

**Indexes**: `[status]`

**Relations**: referenced by Driver.vehicleId (one-to-many from Vehicle to Driver)

### RefreshToken (`refresh_tokens` table)

Not modified by this feature. Supports token rotation with family-based revocation.

## Enums

### OnboardingStatus

```
PENDING_DOCUMENTS → UNDER_REVIEW → APPROVED
                                  → REJECTED → PENDING_DOCUMENTS (on resubmit)
```

### DocumentStatus

```
PENDING → APPROVED
        → REJECTED → PENDING (on resubmit)
```

## State Transitions

### OnboardingStatus

| From              | To                | Trigger                                                       |
| ----------------- | ----------------- | ------------------------------------------------------------- |
| PENDING_DOCUMENTS | UNDER_REVIEW      | Auto: all 3 doc types uploaded (identity + license + vehicle) |
| UNDER_REVIEW      | APPROVED          | Admin action                                                  |
| UNDER_REVIEW      | REJECTED          | Admin action                                                  |
| REJECTED          | PENDING_DOCUMENTS | Auto: when driver resubmits rejected docs                     |

### DocumentStatus (per document type)

| From     | To       | Trigger                            |
| -------- | -------- | ---------------------------------- |
| PENDING  | APPROVED | Admin approves                     |
| PENDING  | REJECTED | Admin rejects with reason          |
| REJECTED | PENDING  | Driver resubmits (if attempts < 3) |

## Validation Rules

| Field                | Rule                                                               |
| -------------------- | ------------------------------------------------------------------ |
| User.email           | Valid email format, unique                                         |
| User.phoneNumber     | E.164 format, 8-15 chars, unique                                   |
| User.password        | Min 6 characters (before bcrypt)                                   |
| Driver.licenseNumber | Unique, populated during license upload                            |
| Vehicle.plateNumber  | Regex: `^[A-Z]{2,3}-[0-9]{4}$`, unique                             |
| Vehicle.year         | Between (currentYear - 20) and (currentYear + 1)                   |
| Identity images      | Exactly 3 files, JPEG/PNG/WebP, max 10MB each                      |
| License images       | Exactly 2 files, JPEG/PNG/WebP, max 10MB each                      |
| Vehicle images       | 2 files (carImage + carLicenseImage), JPEG/PNG/WebP, max 10MB each |
| Upload attempts      | Max 3 per document type (identity, license, vehicle)               |

## Storage Paths (MinIO)

| Document Type     | Object Path Pattern                             |
| ----------------- | ----------------------------------------------- |
| Identity          | `drivers/{userId}/identity/{uuid}.{ext}`        |
| Driving License   | `drivers/{userId}/driving-license/{uuid}.{ext}` |
| Vehicle Car Image | `drivers/{userId}/vehicle/{uuid}.{ext}`         |
| Vehicle License   | `drivers/{userId}/vehicle/{uuid}.{ext}`         |

All stored in bucket `ain-rider`. Presigned URLs valid for 1 hour (3600 seconds).

## Changes from Existing Implementation

| Component                             | Change                                                                              | Impact                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `driver-onboarding.controller.ts`     | Accept `licenseNumber` as multipart field in `uploadDrivingLicense`                 | Controller extracts field alongside files         |
| `driver-onboarding.service.ts`        | `uploadDrivingLicense` saves `licenseNumber` to Driver record; adds duplicate check | Service validates uniqueness before saving        |
| `api-gateway/modules/auth/index.ts`   | Add 6 proxy routes for `/auth/driver/*` endpoints                                   | New gateway routes following rider upload pattern |
| `api-gateway/modules/auth/service.ts` | Add proxy methods for driver endpoints                                              | New static methods in `AuthProxyService`          |

**No Prisma schema changes.** The `Driver.licenseNumber` field already exists as a unique String column. It is currently created with an empty string placeholder and will be populated during the driving license upload step.
