# Implementation Plan: Driver Registration Flow

**Branch**: `006-driver-registration-flow` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-driver-registration-flow/spec.md`

## Summary

Complete the end-to-end driver registration flow from the mobile app perspective: phone OTP verification, account creation, profile completion, document uploads (identity + license), vehicle registration, and onboarding status tracking. The primary new work is (1) adding API gateway proxy routes for the 6 existing `/auth/driver/*` endpoints that currently only exist in the auth-service, (2) modifying the driving license upload to accept and persist a license number, and (3) enforcing file size limits at the gateway level.

## Technical Context

**Language/Version**: TypeScript, Node.js 20+ (NestJS for auth-service), Bun (ElysiaJS for api-gateway)
**Primary Dependencies**: NestJS, ElysiaJS, Prisma, @ain-rider/minio-client, @ain-rider/nats-client, @ain-rider/shared-types, @fastify/multipart, passport-jwt, class-validator
**Storage**: PostgreSQL (TimescaleDB) via Prisma for auth-service; MinIO for object storage (bucket: `ain-rider`)
**Testing**: Jest (unit/integration tests via `npm test`)
**Target Platform**: Linux server (Docker containers on Kubernetes)
**Project Type**: Web service (microservices architecture)
**Performance Goals**: Driver registration endpoints <2s response time, file uploads <5s for documents up to 10MB
**Constraints**: 10MB max file size per image, 3 upload attempts per document type, 15 OTP requests/minute rate limit
**Scale/Scope**: Thousands of concurrent driver registration sessions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status | Notes                                                                                                                   |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| I. Gateway-Centricity        | PASS   | Spec explicitly requires proxying all driver endpoints through the gateway (User Story 2, FR-010)                       |
| II. Error Transparency       | PASS   | Existing structured JSON logging in both services; global exception filter catches and logs all errors                  |
| III. Unified Response Schema | PASS   | Responses follow `{ success, data }` / `{ success, error: { code, message } }` pattern consistently                     |
| IV. Transport-Agnostic Logic | PASS   | Controllers are thin adapters; service methods contain business logic; global exception filter handles errors uniformly |
| V. Race Condition Prevention | PASS   | Upload attempt counters incremented atomically via Prisma upsert; document uploads use last-write-wins                  |

**Re-check after Phase 1**: All principles remain satisfied. No new services, no new transport mechanisms, no new shared-state mutations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/006-driver-registration-flow/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
├── contracts/           # Phase 1 API contracts
│   └── auth-driver-routes.md
└── tasks.md             # Phase 2 tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/
├── nest/
│   └── auth-service/                    # PRIMARY: auth-service changes
│       ├── prisma/
│       │   └── schema.prisma            # No changes (schema already has all fields)
│       └── src/
│           ├── main.ts                  # Existing: Fastify multipart setup
│           ├── app.module.ts            # Existing: no changes
│           ├── auth/
│           │   ├── auth.module.ts       # Existing: no changes
│           │   ├── auth.controller.ts   # Existing: OTP + register endpoints
│           │   ├── auth.service.ts      # Existing: register creates Driver shell
│           │   ├── jwt.strategy.ts      # Existing: JWT validation
│           │   ├── jwt-auth.guard.ts    # Existing: route protection
│           │   ├── guards/
│           │   │   ├── driver.guard.ts  # Existing: DRIVER role check
│           │   │   └── rider.guard.ts   # Existing: RIDER role check
│           │   └── dto/
│           │       ├── register.dto.ts  # Existing: no changes
│           │       ├── request-otp.dto.ts  # Existing: no changes
│           │       └── verify-otp.dto.ts   # Existing: no changes
│           ├── driver-onboarding/
│           │   ├── driver-onboarding.module.ts       # Existing: no changes
│           │   ├── driver-onboarding.controller.ts   # MODIFY: accept licenseNumber field
│           │   ├── driver-onboarding.service.ts       # MODIFY: save licenseNumber to Driver
│           │   └── dto/
│           │       ├── update-driver-profile.dto.ts   # Existing: no changes
│           │       ├── update-online-status.dto.ts    # Existing: no changes
│           │       ├── register-vehicle.dto.ts        # Existing: no changes
│           │       └── onboarding-status.dto.ts       # Existing: no changes
│           ├── shared/
│           │   ├── storage/
│           │   │   ├── storage.module.ts   # Existing: Global MinIO wrapper
│           │   │   └── storage.service.ts  # Existing: upload, presign, delete
│           │   └── types/
│           │       └── uploaded-file.interface.ts  # Existing: no changes
│           └── events/
│               ├── driver-event.publisher.ts  # Existing: driver.approved event
│               └── user-event.publisher.ts    # Existing: user lifecycle events
│
└── elysia/
    └── api-gateway/                     # PRIMARY: gateway proxy route changes
        └── src/
            ├── index.ts                 # Existing: mounts all modules
            └── modules/
                └── auth/
                    ├── index.ts         # MODIFY: add 6 driver proxy routes
                    ├── service.ts       # MODIFY: add driver proxy methods
                    ├── guard.ts         # Existing: JWT verification
                    └── model.ts         # Existing: request/response schemas

packages/
├── shared-types/       # Existing: UserRole, NATS_SUBJECTS, event types
└── minio-client/       # Existing: StorageClient wrapper
```

**Structure Decision**: Monorepo with `apps/nest/auth-service` (NestJS/Fastify) and `apps/elysia/api-gateway` (ElysiaJS/Bun). Changes are confined to two existing projects: auth-service (license number in upload endpoint) and api-gateway (new driver proxy routes). No new projects or packages needed.

## Complexity Tracking

> No constitution violations. Table not needed.
