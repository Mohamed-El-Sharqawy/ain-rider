# Implementation Plan: OTP Provider Authentication

**Branch**: `004-otp-provider-auth` | **Date**: 2026-03-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-otp-provider-auth/spec.md`

## Summary

Implement OTP phone verification with configurable provider abstraction. Development uses simulated console-based provider; production uses Firebase Phone Auth. Verification returns phone number + uid and publishes `otp_verified` NATS event for downstream services to handle user creation.

## Technical Context

**Language/Version**: TypeScript (Bun for Elysia, Node.js 20+ for NestJS)
**Primary Dependencies**: ElysiaJS (api-gateway), NestJS (auth-service), firebase-admin, @nestjs/jwt, Prisma
**Storage**: PostgreSQL (auth-service), Redis (rate limiting)
**Testing**: pnpm test
**Target Platform**: Linux server (Docker containers)
**Project Type**: Web service (microservices architecture)
**Performance Goals**: <500ms response time, <100ms NATS publish
**Constraints**: Rate limiting 10/min per IP, 5/hour per phone
**Scale/Scope**: Large-scale ride-hailing platform

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status | Evidence                                                        |
| ---------------------------- | ------ | --------------------------------------------------------------- |
| I. Gateway-Centricity        | PASS   | All OTP routes go through api-gateway → auth-service            |
| II. Error Transparency       | PASS   | Errors logged with traceId, service context                     |
| III. Unified Response Schema | PASS   | Success/error responses follow `{ success, data/error }` format |
| IV. Transport-Agnostic Logic | PASS   | AuthService.verifyOtp() has no HTTP dependencies                |
| V. Race Condition Prevention | N/A    | Stateless verification, no concurrent mutations                 |

**Gate Status**: PASS - No violations

## Project Structure

### Documentation (this feature)

```text
specs/004-otp-provider-auth/
├── spec.md              # Feature specification
├── impl-plan.md         # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
    └── verify-otp.yaml  # API contract
```

### Source Code (repository root)

```text
apps/
├── elysia/api-gateway/src/modules/auth/
│   ├── index.ts         # Route: POST /auth/verify-otp
│   ├── service.ts       # Proxy to auth-service
│   └── model.ts         # Request/response validation
│
└── nest/auth-service/src/
    ├── auth/
    │   ├── auth.controller.ts   # POST /auth/verify-otp endpoint
    │   ├── auth.service.ts      # verifyOtp() method
    │   ├── auth.module.ts       # FirebaseService registration
    │   └── firebase.service.ts  # Firebase Admin SDK wrapper
    └── events/
        └── user-event.publisher.ts  # publishOtpVerified()

packages/shared-types/src/
└── events.types.ts      # OtpVerifiedEvent type + NATS_SUBJECTS.OTP_VERIFIED
```

**Structure Decision**: Follows existing monorepo microservices pattern with api-gateway proxying to auth-service.

## Complexity Tracking

No violations - implementation follows established patterns.
