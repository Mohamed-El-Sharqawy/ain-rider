# NATS JetStream Implementation Guide

This document describes the current state of NATS JetStream in the Ain-Rider backend, including architecture, robustness patterns, and the "Service-Self-Initialization" strategy.

## 1. Overview
Ain-Rider uses **NATS JetStream** as its primary event backbone. Unlike standard NATS, JetStream provides built-in persistence, flow control, and redelivery guarantees, making it suitable for high-concurrency operations like ride-hailing.

## 2. Dynamic Stream Management
We implement an idempotent "Self-Healing" stream management strategy. Each service is responsible for ensuring its required subjects are covered by a stream during startup.

### StreamManager
Located in `@ain-rider/nats-client`, the `StreamManager` handles:
- **Idempotent Creation**: Tries to create a stream; updates it if already exists.
- **Overlap Resolution**: If a subject conflict (NATS Error 10065) is detected, it automatically finds the overlapping stream and merges the subjects.
- **Environment Awareness**: Configures 3 replicas for production and 1 for local development.

### Service Integration Example
```typescript
// auth-service/src/shared/nats/nats.service.ts
await sm.ensureStream('AIN_RIDER_AUTH', {
  subjects: ['ain_rider.user.*', 'ain_rider.otp.*'],
  storage: 'file',
});
```

## 3. Subject Hierarchy (Uber-Scale)
To avoid "Greedy Wildcard" conflicts and ensure clean routing, we use a fine-grained hierarchical subject structure:

| Domain | Subject Pattern | Description |
| :--- | :--- | :--- |
| **Auth** | `ain_rider.user.*` | Lifecycle (created, updated, deleted) |
| **Auth** | `ain_rider.otp.*` | Verification events |
| **Trip** | `ain_rider.trip.*` | Booking, matching, status changes |
| **Payment** | `ain_rider.payment.*` | Success, failure, refunds |

## 4. Reliability Patterns

### 4.1 Message Enveloping
All published events are wrapped in a standard `EventEnvelope`:
- `eventId`: Unique UUID for idempotency.
- `traceId`: W3C Tracing ID for Zipkin/Jaeger.
- `timestamp`: ISO-8601 creation time.

### 4.2 Idempotency (Exactly-Once Processing)
The `JetStreamConsumer` integrates with a Redis-backed `IdempotencyService`.
1. Consumer receives message.
2. Checks Redis: `idempotency:{consumerName}:{eventId}`.
3. If exists, `ack()` and skip.
4. If not, process ➔ `markProcessed()` ➔ `ack()`.

### 4.3 Dead Letter Queue (DLQ)
Messages that fail more than 3 times (`max_deliver`) are automatically moved to:
`ain_rider.dlq.<original_subject>`
Ops can then inspect the `DLQMessage` which includes the stack trace and original payload.

## 5. Deployment Info
- **NATS Cluster**: 3 nodes (mapped to `localhost:4222`, `4223`, `4224`).
- **Persistence**: Messages are stored in `/data/jetstream` on the NATS nodes.
- **Automatic Init**: While services self-init, a `nats-init` container in `docker-compose.yml` provides a safety net for core global streams.

---
*Last Updated: 2026-03-27*
