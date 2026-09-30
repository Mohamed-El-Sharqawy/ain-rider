# Implementation Plan: Driver & Rider Onboarding

**Branch**: `005-driver-rider-onboarding` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-driver-rider-onboarding/spec.md`

## Summary

Implement driver and rider onboarding endpoints in auth-service with document uploads to MinIO, vehicle registration, and onboarding status tracking. Drivers upload identity documents, driving license, and vehicle information through separate endpoints. Status automatically transitions to UNDER_REVIEW when all documents are uploaded. Admin approval triggers NATS event for downstream services.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+ (NestJS for auth-service)
**Primary Dependencies**: NestJS, @nestjs/jwt, Prisma, minio client, @ain-rider/nats-client, @ain-rider/shared-types
**Storage**: PostgreSQL (TimescaleDB) via Prisma for auth-service, MinIO for document storage
**Testing**: Jest (NestJS testing utilities)
**Target Platform**: Linux server (Docker containers)
**Project Type**: web-service (microservice in monorepo)
**Performance Goals**: Image uploads <5s for 10MB files, onboarding status <500ms response
**Constraints**: Presigned URLs expire in 1 hour, max 3 retry attempts per document type, max 10MB per image
**Scale/Scope**: All driver/rider onboarding flows, ~1000 concurrent uploads estimated

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status  | Notes                                                                                   |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------- |
| I. Gateway-Centricity        | ✅ PASS | All /auth/driver/_ and /auth/rider/_ endpoints accessed via api-gateway                 |
| II. Error Transparency       | ✅ PASS | Will use existing global exception filter pattern; all errors logged with traceId       |
| III. Unified Response Schema | ✅ PASS | Success: `{success, data}`, Error: `{success: false, error: {code, message}}`           |
| IV. Transport-Agnostic Logic | ✅ PASS | Service methods decoupled from controllers; same logic works via HTTP or NATS           |
| V. Race Condition Prevention | ✅ PASS | Document upload attempts tracked atomically; status transitions use Prisma transactions |

**Technology Constraints Compliance:**

- ✅ NestJS with TypeScript strict mode
- ✅ NATS JetStream for driver.approved event (3000ms timeout)
- ✅ PostgreSQL with Prisma ORM
- ✅ MinIO for document storage (existing bucket: ain-rider)

## Project Structure

### Documentation (this feature)

```text
specs/005-driver-rider-onboarding/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI spec for onboarding endpoints
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
apps/nest/auth-service/
├── src/
│   ├── auth/
│   │   ├── guards/
│   │   │   ├── driver.guard.ts      # NEW: Role check for DRIVER
│   │   │   └── rider.guard.ts       # NEW: Role check for RIDER
│   │   └── jwt-auth.guard.ts        # EXISTING
│   ├── driver-onboarding/           # NEW MODULE
│   │   ├── driver-onboarding.module.ts
│   │   ├── driver-onboarding.controller.ts
│   │   ├── driver-onboarding.service.ts
│   │   └── dto/
│   │       ├── update-driver-profile.dto.ts
│   │       ├── upload-identity-docs.dto.ts
│   │       ├── upload-license-docs.dto.ts
│   │       ├── register-vehicle.dto.ts
│   │       └── onboarding-status.dto.ts
│   ├── rider-profile/               # NEW MODULE
│   │   ├── rider-profile.module.ts
│   │   ├── rider-profile.controller.ts
│   │   ├── rider-profile.service.ts
│   │   └── dto/
│   │       └── upload-profile-image.dto.ts
│   ├── shared/
│   │   ├── storage/                 # NEW: MinIO client (reused pattern from admin-service)
│   │   │   ├── storage.module.ts
│   │   │   ├── storage.service.ts
│   │   │   └── storage.config.ts
│   │   └── nats/                    # EXISTING
│   ├── events/
│   │   └── driver-event.publisher.ts  # NEW: driver.approved event
│   └── prisma/                      # EXISTING
├── prisma/
│   └── schema.prisma                # UPDATE: Add models, modify Driver
└── test/
    └── driver-onboarding/
        ├── driver-onboarding.controller.spec.ts
        ├── driver-onboarding.service.spec.ts
        └── rider-profile.service.spec.ts

packages/shared-types/src/
└── events.types.ts                  # UPDATE: Add DRIVER_APPROVED subject
```

**Structure Decision**: Using NestJS modular structure within auth-service. New modules for driver-onboarding and rider-profile. Shared storage module follows admin-service pattern.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | -          | -                                    |
