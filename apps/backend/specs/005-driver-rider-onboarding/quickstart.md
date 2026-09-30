# Quickstart: Driver & Rider Onboarding

**Feature**: 005-driver-rider-onboarding
**Date**: 2026-03-28

## Prerequisites

- Node.js 20+ installed
- Docker and Docker Compose running
- PostgreSQL (TimescaleDB) accessible
- MinIO running with bucket `ain-rider`
- NATS JetStream cluster running

## Environment Variables

Add to `apps/nest/auth-service/.env`:

```env
# MinIO Configuration (reuse from admin-service pattern)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_REGION=us-east-1
MINIO_BUCKET=ain-rider
MINIO_PRESIGNED_URL_TTL=3600

# NATS Configuration (existing)
NATS_SERVERS=nats://localhost:4222,nats://localhost:4223,nats://localhost:4224
```

## Database Migration

```bash
# Navigate to auth-service
cd apps/nest/auth-service

# Create migration for new models
npx prisma migrate dev --name add_driver_onboarding_models

# Generate Prisma client
npx prisma generate
```

## API Endpoints

### Driver Endpoints

```bash
# Update driver profile
PATCH /auth/driver/profile
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "address": "123 Main St",
  "emergencyContactName": "John Doe",
  "emergencyContactPhone": "+1234567890"
}

# Upload identity documents (3 images)
POST /auth/driver/documents/identity
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

files: [image1.jpg, image2.jpg, image3.jpg]

# Upload driving license (2 images)
POST /auth/driver/documents/driving-license
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

files: [license_front.jpg, license_back.jpg]

# Register vehicle
POST /auth/driver/vehicle
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

make: "Toyota"
model: "Camry"
year: 2022
color: "White"
plateNumber: "ABC-1234"
carImage: <file>
carLicenseImage: <file>

# Get onboarding status
GET /auth/driver/onboarding-status
Authorization: Bearer <jwt>
```

### Rider Endpoints

```bash
# Upload profile image
PATCH /auth/rider/profile/image
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

image: <file>
```

## Response Format

All responses follow the unified schema:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Exactly 3 images required"
  }
}
```

## Testing

```bash
# Run unit tests
cd apps/nest/auth-service
npm test -- driver-onboarding

# Run e2e tests
npm run test:e2e -- driver-onboarding
```

## Key Implementation Files

| File                                                    | Purpose              |
| ------------------------------------------------------- | -------------------- |
| `src/driver-onboarding/driver-onboarding.module.ts`     | Module registration  |
| `src/driver-onboarding/driver-onboarding.controller.ts` | API endpoints        |
| `src/driver-onboarding/driver-onboarding.service.ts`    | Business logic       |
| `src/rider-profile/rider-profile.module.ts`             | Rider module         |
| `src/shared/storage/storage.service.ts`                 | MinIO integration    |
| `src/auth/guards/driver.guard.ts`                       | Driver role check    |
| `src/auth/guards/rider.guard.ts`                        | Rider role check     |
| `src/events/driver-event.publisher.ts`                  | NATS event publisher |

## Status Flow

```
Registration → PENDING_DOCUMENTS
     ↓
Upload identity + license + vehicle
     ↓
UNDER_REVIEW (auto-transition)
     ↓
Admin approves → APPROVED
     ↓
NATS event published (driver.approved)
```

## MinIO Object Paths

| Document Type   | Path Pattern                                  |
| --------------- | --------------------------------------------- |
| Identity        | `drivers/{userId}/identity/{uuid}.jpg`        |
| Driving License | `drivers/{userId}/driving-license/{uuid}.jpg` |
| Vehicle         | `drivers/{userId}/vehicle/{uuid}.jpg`         |
| Rider Profile   | `riders/{userId}/profile/{uuid}.jpg`          |

## Common Error Codes

| Code                  | HTTP Status | Description               |
| --------------------- | ----------- | ------------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid request data      |
| `UNAUTHORIZED`        | 401         | Missing or invalid JWT    |
| `FORBIDDEN`           | 403         | Wrong user role           |
| `CONFLICT`            | 409         | Documents already exist   |
| `PAYLOAD_TOO_LARGE`   | 413         | File exceeds 10MB         |
| `TOO_MANY_REQUESTS`   | 429         | Retry limit exceeded (3)  |
| `SERVICE_UNAVAILABLE` | 503         | MinIO or NATS unavailable |
