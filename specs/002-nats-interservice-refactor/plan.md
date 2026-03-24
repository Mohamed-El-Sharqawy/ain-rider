# Implementation Plan: NATS Inter-Service Communication Refactor

**Branch**: `002-nats-interservice-refactor` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-nats-interservice-refactor/spec.md`

## Summary

Migrate all inter-service communication from direct HTTP calls to NATS JetStream (async events) and NATS Core (sync request/reply). This enforces strict database ownership boundaries where each service owns its data and communicates state changes via events. The refactor eliminates service coupling, enables horizontal scaling, and provides reliable message delivery with at-least-once semantics.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20+ (NestJS), Bun (Elysia)  
**Primary Dependencies**: NATS JetStream, @ain-rider/nats-client, Prisma ORM, H3 (geospatial)  
**Storage**: PostgreSQL + TimescaleDB (persistent), Redis Cluster (state/cache)  
**Testing**: Jest (NestJS), Bun test (Elysia), integration tests with NATS testcontainer  
**Target Platform**: Linux containers (Docker/Kubernetes)  
**Project Type**: Microservices backend (8 services)  
**Performance Goals**: 3s trip match, 500ms location propagation, 1000 concurrent trips  
**Constraints**: 5s admin operation timeout, 7-day operational event retention, 30-day financial retention  
**Scale/Scope**: 8 services, 50 functional requirements, ~25 NATS subjects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Gateway-Centricity** | ✅ PASS | API Gateway remains HTTP proxy only; internal services communicate via NATS |
| **II. Error Transparency** | ✅ PASS | All NATS errors logged with traceId; DLQ for failed messages with alerting |
| **III. Unified Response Schema** | ✅ PASS | NATS timeouts map to 503; error payloads follow standard format |
| **IV. Transport-Agnostic Logic** | ✅ PASS | Business logic in services; NATS handlers are thin adapters |
| **V. Race Condition Prevention** | ✅ PASS | Redis atomic ops for driver matching; idempotent event handlers |

**Technology Constraints Compliance:**
- ✅ NATS JetStream for async events
- ✅ NATS Request-Reply for sync commands (5s timeout for admin ops)
- ✅ Redis for shared fast state (driver pool, locations)
- ✅ Prometheus metrics, structured JSON logging

## Project Structure

### Documentation (this feature)

```text
specs/002-nats-interservice-refactor/
├── plan.md              # This file
├── research.md          # Phase 0: NATS patterns research
├── data-model.md        # Phase 1: Event schemas, stream config
├── quickstart.md        # Phase 1: Integration guide
├── contracts/           # Phase 1: NATS subject contracts
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
packages/
├── nats-client/                 # Shared NATS utilities (existing)
│   ├── src/
│   │   ├── jetstream/           # JetStream publisher/consumer helpers
│   │   ├── request-reply/       # Request/reply patterns
│   │   ├── dlq/                 # Dead letter queue handling
│   │   └── tracing/             # W3C trace-context propagation
│   └── tests/

apps/
├── elysia/
│   ├── api-gateway/             # HTTP proxy only (no NATS changes)
│   ├── location-service/        # JetStream publisher
│   └── websocket-server/        # JetStream consumer only
│
└── nest/
    ├── auth-service/            # JetStream publisher + NATS responder
    │   └── src/
    │       ├── nats/            # NATS module, handlers
    │       └── events/          # Event publishers
    │
    ├── trip-service/            # JetStream pub/sub + NATS responder
    │   └── src/
    │       ├── nats/
    │       ├── events/
    │       └── consumers/       # trip_matched consumer
    │
    ├── match-service/           # JetStream consumer + publisher
    │   └── src/
    │       ├── nats/
    │       ├── consumers/       # trip_requested consumer
    │       └── redis/           # H3 driver pool
    │
    ├── payment-service/         # JetStream consumer + publisher + responder
    │   └── src/
    │       ├── nats/
    │       ├── consumers/       # trip_completed consumer
    │       └── events/
    │
    └── admin-service/           # NATS requester + JetStream publisher
        └── src/
            ├── nats/            # Request client
            └── events/
```

**Structure Decision**: Microservices monorepo with shared packages. Each NestJS service gets a `nats/` module for handlers and an `events/` module for publishers. The `@ain-rider/nats-client` package provides shared utilities for JetStream, request/reply, DLQ, and tracing.

## Complexity Tracking

No constitution violations requiring justification. The refactor aligns with all core principles.
