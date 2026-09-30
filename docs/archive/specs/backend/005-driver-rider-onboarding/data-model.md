# Data Model: Driver & Rider Onboarding

**Feature**: 005-driver-rider-onboarding
**Date**: 2026-03-28

## Entity Relationship Diagram

```
User ────1:1──── Driver ───1:1─── DriverDocument
   │                │
   │                └────1:1─── Vehicle
   │
   └────1:1──── Rider
```

## Enums

### OnboardingStatus

| Value             | Description                                     |
| ----------------- | ----------------------------------------------- |
| PENDING_DOCUMENTS | Driver has not completed all required uploads   |
| UNDER_REVIEW      | All documents uploaded, awaiting admin approval |
| APPROVED          | Admin has approved driver, can accept rides     |
| REJECTED          | Documents rejected, driver must resubmit        |

### DocumentStatus

| Value    | Description                              |
| -------- | ---------------------------------------- |
| PENDING  | Uploaded, awaiting review                |
| APPROVED | Verified by admin                        |
| REJECTED | Rejected by admin, requires resubmission |

## Models

### Driver (Modified)

| Field            | Type             | Nullable | Default           | Notes                          |
| ---------------- | ---------------- | -------- | ----------------- | ------------------------------ |
| id               | String (UUID)    | No       | auto              | Primary key                    |
| userId           | String (UUID)    | No       | -                 | FK to User, unique             |
| vehicleId        | String (UUID)    | Yes      | null              | FK to Vehicle                  |
| licenseNumber    | String           | No       | -                 | Unique                         |
| rating           | Float            | No       | 5.0               |                                |
| totalTrips       | Int              | No       | 0                 |                                |
| ~~isOnline~~     | ~~Boolean~~      | ~~No~~   | ~~false~~         | **REMOVED** - managed in Redis |
| onboardingStatus | OnboardingStatus | No       | PENDING_DOCUMENTS | **NEW**                        |
| createdAt        | DateTime         | No       | now()             |                                |
| updatedAt        | DateTime         | No       | updatedAt()       |                                |

**Changes**:

- ADD: `onboardingStatus` field with enum type
- REMOVE: `isOnline` field (lives in Redis, managed by location-service)

---

### DriverDocument (New)

| Field                         | Type           | Nullable | Default     | Notes                |
| ----------------------------- | -------------- | -------- | ----------- | -------------------- |
| id                            | String (UUID)  | No       | auto        | Primary key          |
| driverId                      | String (UUID)  | No       | -           | FK to Driver, unique |
| identityImages                | String[]       | No       | []          | MinIO object keys    |
| identityStatus                | DocumentStatus | No       | PENDING     |                      |
| identityRejectionReason       | String?        | Yes      | null        |                      |
| identityUploadAttempts        | Int            | No       | 0           | Tracks retry count   |
| drivingLicenseImages          | String[]       | No       | []          | MinIO object keys    |
| drivingLicenseStatus          | DocumentStatus | No       | PENDING     |                      |
| drivingLicenseRejectionReason | String?        | Yes      | null        |                      |
| drivingLicenseUploadAttempts  | Int            | No       | 0           | Tracks retry count   |
| createdAt                     | DateTime       | No       | now()       |                      |
| updatedAt                     | DateTime       | No       | updatedAt() |                      |

**Constraints**:

- `driverId` is unique (one-to-one with Driver)
- `identityUploadAttempts` max value: 3 (enforced in service layer)
- `drivingLicenseUploadAttempts` max value: 3 (enforced in service layer)

---

### Vehicle (New)

| Field           | Type           | Nullable | Default     | Notes                         |
| --------------- | -------------- | -------- | ----------- | ----------------------------- |
| id              | String (UUID)  | No       | auto        | Primary key                   |
| make            | String         | No       | -           | e.g., "Toyota"                |
| model           | String         | No       | -           | e.g., "Camry"                 |
| year            | Int            | No       | -           | 4-digit year                  |
| color           | String         | No       | -           | e.g., "White"                 |
| plateNumber     | String         | No       | -           | e.g., "ABC-1234"              |
| carImage        | String         | No       | -           | MinIO object key              |
| carLicenseImage | String         | No       | -           | MinIO object key              |
| carLicenseText  | String?        | Yes      | null        | OCR-extracted text (optional) |
| status          | DocumentStatus | No       | PENDING     |                               |
| rejectionReason | String?        | Yes      | null        |                               |
| uploadAttempts  | Int            | No       | 0           | Tracks retry count            |
| createdAt       | DateTime       | No       | now()       |                               |
| updatedAt       | DateTime       | No       | updatedAt() |                               |

**Constraints**:

- `year` must be between (currentYear - 20) and currentYear + 1
- `plateNumber` format validated per region (configurable pattern)
- `uploadAttempts` max value: 3 (enforced in service layer)

---

### User (Modified)

| Field        | Type          | Nullable | Default     | Notes                         |
| ------------ | ------------- | -------- | ----------- | ----------------------------- |
| id           | String (UUID) | No       | auto        | Primary key                   |
| email        | String        | No       | -           | Unique                        |
| phoneNumber  | String        | No       | -           | Unique                        |
| passwordHash | String        | No       | -           |                               |
| firstName    | String        | No       | -           |                               |
| lastName     | String        | No       | -           |                               |
| role         | String        | No       | -           | RIDER, DRIVER, ADMIN, SUPPORT |
| status       | String        | No       | ACTIVE      |                               |
| profileImage | String?       | Yes      | null        | **MODIFIED**: Full MinIO URL  |
| createdAt    | DateTime      | No       | now()       |                               |
| updatedAt    | DateTime      | No       | updatedAt() |                               |

**Changes**:

- `profileImage` now stores full MinIO URL for rider profile images

---

## State Transitions

### Driver Onboarding Status

```
PENDING_DOCUMENTS ──(all docs uploaded)──> UNDER_REVIEW
       ↑                                        │
       │                                        │
       └──(rejected, retryable)─────────────────┤
                                                │
                                                ├──(approved)──> APPROVED
                                                │
                                                └──(rejected, max retries)──> REJECTED*
                                                    *requires admin contact
```

### Document Status

```
PENDING ──(admin approves)──> APPROVED
    │
    └──(admin rejects)──> REJECTED ──(driver resubmits)──> PENDING
```

## Indexes

### DriverDocument

- `driverId` (unique) - for 1:1 lookup
- `identityStatus` - for admin review queries
- `drivingLicenseStatus` - for admin review queries

### Vehicle

- `plateNumber` (unique) - prevent duplicate registrations
- `status` - for admin review queries

## Prisma Schema (Reference)

```prisma
enum OnboardingStatus {
  PENDING_DOCUMENTS
  UNDER_REVIEW
  APPROVED
  REJECTED
}

enum DocumentStatus {
  PENDING
  APPROVED
  REJECTED
}

model Driver {
  id              String            @id @default(uuid())
  userId          String            @unique
  vehicleId       String?
  licenseNumber   String            @unique
  rating          Float             @default(5.0)
  totalTrips      Int               @default(0)
  onboardingStatus OnboardingStatus @default(PENDING_DOCUMENTS)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  user    User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  vehicle Vehicle?       @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  document DriverDocument?

  @@map("drivers")
}

model DriverDocument {
  id                          String          @id @default(uuid())
  driverId                    String          @unique
  identityImages              String[]
  identityStatus              DocumentStatus  @default(PENDING)
  identityRejectionReason     String?
  identityUploadAttempts      Int             @default(0)
  drivingLicenseImages        String[]
  drivingLicenseStatus        DocumentStatus  @default(PENDING)
  drivingLicenseRejectionReason String?
  drivingLicenseUploadAttempts Int            @default(0)
  createdAt                   DateTime        @default(now())
  updatedAt                   DateTime        @updatedAt

  driver Driver @relation(fields: [driverId], references: [id], onDelete: Cascade)

  @@index([identityStatus])
  @@index([drivingLicenseStatus])
  @@map("driver_documents")
}

model Vehicle {
  id               String         @id @default(uuid())
  make             String
  model            String
  year             Int
  color            String
  plateNumber      String         @unique
  carImage         String
  carLicenseImage  String
  carLicenseText   String?
  status           DocumentStatus @default(PENDING)
  rejectionReason  String?
  uploadAttempts   Int            @default(0)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  drivers Driver[]

  @@index([status])
  @@map("vehicles")
}
```
