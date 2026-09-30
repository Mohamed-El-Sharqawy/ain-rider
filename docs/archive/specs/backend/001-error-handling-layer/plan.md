# Implementation Plan: Error Handling Layer

**Branch**: `001-error-handling-layer` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-error-handling-layer/spec.md`

## Summary

Establish a unified error handling layer across the 911 Ain Rider backend to solve the "silent error" problem. This involves:

1. Creating a new `packages/error-handling` shared package with TypeBox schemas and Pino-based logging
2. Implementing a global error handler in Elysia API Gateway with NATS timeout/failure mapping
3. Implementing a GlobalExceptionFilter in NestJS services for transport-agnostic error handling
4. Adding traceId generation and propagation across all service boundaries
5. Integrating automatic sensitive data sanitization in all error paths

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Runtimes**: Bun (Elysia services) + Node.js 20+ (NestJS services)  
**Primary Dependencies**: TypeBox (schema validation), Pino (logging), NATS (messaging)  
**Storage**: N/A (no database changes required)  
**Testing**: Vitest (Elysia), Jest (NestJS)  
**Target Platform**: Linux containers (Docker)  
**Project Type**: Shared library + service modifications  
**Performance Goals**: Error responses within 3.5s (3s NATS timeout + 500ms overhead)  
**Constraints**: Must work in both Bun and Node.js runtimes  
**Scale/Scope**: 8 services (4 Elysia + 4 NestJS)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Gateway-Centricity | ✅ PASS | Error handling originates at api-gateway, propagates to internal services |
| II. Error Transparency | ✅ PASS | Core goal: eliminate silent errors, structured logging with traceId |
| III. Unified Response Schema | ✅ PASS | Defines `{ success, error: { code, message, traceId } }` format |
| IV. Transport-Agnostic Logic | ✅ PASS | GlobalExceptionFilter handles both HTTP and NATS uniformly |
| V. Race Condition Prevention | ✅ N/A | No shared state mutations in error handling |

**Technology Constraints Compliance:**
- ✅ NATS Request-Reply with 3000ms timeout (FR-004)
- ✅ NATS timeouts map to HTTP 503 (FR-002, FR-003)
- ✅ Structured JSON logging to stdout (FR-014)

## Project Structure

### Documentation (this feature)

```text
specs/001-error-handling-layer/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: TypeBox schemas
├── quickstart.md        # Phase 1: Integration guide
├── contracts/           # Phase 1: Error response contracts
│   └── error-response.json
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
packages/
└── error-handling/                    # NEW: Shared error handling package
    ├── src/
    │   ├── index.ts                   # Public exports
    │   ├── schemas/
    │   │   ├── error-response.ts      # TypeBox ErrorResponse schema
    │   │   ├── error-codes.ts         # Error code constants
    │   │   └── trace-context.ts       # TraceContext schema
    │   ├── errors/
    │   │   ├── app-error.ts           # Base AppError class
    │   │   ├── validation-error.ts    # ValidationError
    │   │   ├── not-found-error.ts     # NotFoundError
    │   │   └── service-unavailable.ts # ServiceUnavailableError
    │   ├── logger/
    │   │   ├── pino-logger.ts         # Pino wrapper with traceId
    │   │   └── sanitizer.ts           # Sensitive data redaction
    │   ├── nats/
    │   │   ├── nats-request.ts        # Timeout-aware NATS request wrapper
    │   │   └── nats-serializer.ts     # AppError serialization/deserialization
    │   └── middleware/
    │       ├── trace-middleware.ts    # TraceId generation/extraction
    │       └── error-mapper.ts        # Error to HTTP status mapping
    ├── package.json
    └── tsconfig.json

apps/elysia/api-gateway/
└── src/
    ├── shared/
    │   ├── error-handler.ts           # MODIFIED: Global .onError() handler
    │   ├── nats-client.ts             # MODIFIED: Use nats-request wrapper
    │   └── trace.ts                   # NEW: TraceId middleware
    └── index.ts                       # MODIFIED: Register error handler

apps/nest/auth-service/               # Pattern applies to all 4 NestJS services
└── src/
    ├── shared/
    │   ├── filters/
    │   │   └── global-exception.filter.ts  # NEW: GlobalExceptionFilter
    │   ├── interceptors/
    │   │   └── trace.interceptor.ts        # NEW: TraceId interceptor
    │   └── nats/
    │       └── nats-error.handler.ts       # NEW: NATS reply error handler
    └── main.ts                             # MODIFIED: Register filter globally
```

**Structure Decision**: Microservices monorepo with shared packages. The `packages/error-handling` package is created first and consumed by all 8 services.

## Complexity Tracking

| Aspect | Justification |
|--------|---------------|
| New shared package | Required for cross-runtime compatibility (Bun + Node) and DRY principle |
| TypeBox over class-validator | Clarification decision: TypeBox works in both runtimes, class-validator is Node-only |
| Custom NATS serializer | Required to preserve AppError type information across NATS wire protocol |
