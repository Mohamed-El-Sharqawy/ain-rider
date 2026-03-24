# Research: NATS Inter-Service Communication Refactor

**Feature**: 002-nats-interservice-refactor  
**Date**: 2026-03-24

## Overview

This document captures research findings for implementing NATS JetStream and NATS Core patterns across the ain-rider microservices backend.

---

## 1. JetStream Stream Configuration

### Decision
Use two separate streams with different retention policies:
- `AIN_RIDER_OPS` - Operational events (7-day retention)
- `AIN_RIDER_FINANCIAL` - Financial events (30-day retention)

### Rationale
- Separating streams by retention policy simplifies management and compliance
- Financial events require longer retention for audit trails
- Operational events can be purged sooner to reduce storage costs

### Alternatives Considered
- **Single stream with subject-based retention**: Not supported by JetStream
- **Per-service streams**: Too many streams to manage, complicates cross-service subscriptions

### Configuration

```yaml
# AIN_RIDER_OPS Stream
name: AIN_RIDER_OPS
subjects:
  - ain_rider.trip_requested
  - ain_rider.trip_matched
  - ain_rider.trip_started
  - ain_rider.trip_completed
  - ain_rider.trip_cancelled
  - ain_rider.trip_no_match
  - ain_rider.sos_created
  - ain_rider.sos_resolved
  - ain_rider.user_created
  - ain_rider.user_updated
  - ain_rider.user_status_changed
  - ain_rider.user_deleted
  - ain_rider.location_update
  - ain_rider.notification_sent
  - ain_rider.complaint_created
  - ain_rider.complaint_updated
retention: limits
max_age: 7d
storage: file
replicas: 3
discard: old

# AIN_RIDER_FINANCIAL Stream
name: AIN_RIDER_FINANCIAL
subjects:
  - ain_rider.payment_processed
  - ain_rider.wallet_updated
  - ain_rider.withdrawal_requested
  - ain_rider.withdrawal_processed
retention: limits
max_age: 30d
storage: file
replicas: 3
discard: old
```

---

## 2. Consumer Configuration Patterns

### Decision
Use durable pull consumers with explicit acknowledgment for all services.

### Rationale
- Pull consumers allow services to control message flow and backpressure
- Durable consumers survive service restarts without message loss
- Explicit ack ensures at-least-once delivery
- AckWait with redelivery provides automatic retry

### Consumer Template

```yaml
durable_name: "{service}-{subject}-consumer"
ack_policy: explicit
ack_wait: 30s
max_deliver: 3
filter_subject: "ain_rider.{event}"
deliver_policy: all  # For new consumers; use "last" for catch-up
```

### Per-Service Consumers

| Service | Consumer | Subject Filter |
|---------|----------|----------------|
| trip-service | trip-matched-consumer | ain_rider.trip_matched |
| match-service | trip-requested-consumer | ain_rider.trip_requested |
| payment-service | trip-completed-consumer | ain_rider.trip_completed |
| websocket-server | ws-events-consumer | ain_rider.* (filtered in code) |
| admin-service | admin-events-consumer | ain_rider.notification_sent, ain_rider.complaint_* |

---

## 3. Dead Letter Queue Implementation

### Decision
Implement DLQ as a separate JetStream stream with manual replay capability.

### Rationale
- Keeps poison messages out of main streams
- Preserves failed messages for debugging
- Allows manual or automated replay after fixes
- Alerting integration for ops visibility

### DLQ Stream Configuration

```yaml
name: AIN_RIDER_DLQ
subjects:
  - ain_rider.dlq.*
retention: limits
max_age: 30d
storage: file
replicas: 3
```

### DLQ Message Format

```typescript
interface DLQMessage {
  originalSubject: string;
  originalPayload: unknown;
  errorReason: string;
  retryCount: number;
  failedAt: string;  // ISO timestamp
  consumerName: string;
  traceId: string;
}
```

### Retry Flow
1. Consumer receives message
2. Processing fails → nak() with delay
3. After 3 failures (max_deliver), message goes to DLQ
4. Alert sent to ops team
5. Manual review and replay via admin tool

---

## 4. Request/Reply Pattern for Admin Operations

### Decision
Use NATS Core request/reply with 5-second timeout for synchronous admin operations.

### Rationale
- Admin operations require immediate feedback
- 5-second timeout balances responsiveness with allowing complex operations
- NATS Core is simpler than JetStream for request/reply
- Timeout maps to HTTP 503 per constitution

### Subject Naming Convention

```
{domain}.{action}.request
{domain}.{action}.response  # Auto-generated reply subject
```

### Request Subjects

| Subject | Responder | Description |
|---------|-----------|-------------|
| user.suspend.request | auth-service | Suspend user account |
| user.activate.request | auth-service | Reactivate user account |
| user.update.request | auth-service | Update user profile |
| trip.create.request | trip-service | Create new trip |
| trip.cancel.request | trip-service | Cancel active trip |
| trip.assign_driver.request | trip-service | Manually assign driver |
| trip.update_status.request | trip-service | Update trip status |
| payment.refund.request | payment-service | Process refund |
| payment.adjust.request | payment-service | Adjust payment amount |

### Request/Response Format

```typescript
// Request
interface NatsRequest<T> {
  traceId: string;
  requestedBy: string;  // Admin user ID
  timestamp: string;
  data: T;
}

// Response
interface NatsResponse<T> {
  success: boolean;
  traceId: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

---

## 5. Event Payload Versioning

### Decision
Include version field in all event payloads with backward-compatible evolution.

### Rationale
- Allows gradual rollouts during deployments
- Consumers can handle multiple versions during transitions
- Additive-only changes prevent breaking existing consumers
- Version in payload (not subject) keeps routing simple

### Payload Envelope

```typescript
interface EventEnvelope<T> {
  version: number;
  eventType: string;
  timestamp: string;
  traceId: string;
  source: string;  // Service name
  data: T;
}
```

### Versioning Rules
1. Adding optional fields: No version bump required
2. Adding required fields with defaults: Minor version bump
3. Removing or renaming fields: Major version bump (avoid)
4. Consumers MUST ignore unknown fields
5. Consumers MUST handle missing optional fields

---

## 6. Distributed Tracing via NATS Headers

### Decision
Propagate W3C trace-context headers in all NATS messages.

### Rationale
- Standard format compatible with Jaeger, Zipkin, OpenTelemetry
- Headers separate from payload keeps business data clean
- Enables end-to-end request tracing across services
- Supports both JetStream and Core messages

### Header Format

```
traceparent: 00-{trace-id}-{span-id}-{flags}
tracestate: {vendor-specific data}
```

### Implementation

```typescript
// Publishing with trace context
async function publishWithTrace(
  js: JetStreamClient,
  subject: string,
  payload: unknown,
  traceId: string
): Promise<void> {
  const headers = headers();
  headers.set('traceparent', `00-${traceId}-${generateSpanId()}-01`);
  
  await js.publish(subject, encode(payload), { headers });
}

// Consuming with trace extraction
async function consumeWithTrace(msg: JsMsg): Promise<string> {
  const traceparent = msg.headers?.get('traceparent');
  if (traceparent) {
    const [, traceId] = traceparent.split('-');
    return traceId;
  }
  return generateTraceId();  // Fallback
}
```

---

## 7. Redis Driver Pool Design

### Decision
Use H3 hexagonal indexing with Redis sorted sets for driver availability.

### Rationale
- H3 provides consistent hexagonal cells for geospatial queries
- Sorted sets enable efficient range queries by timestamp
- Redis atomic operations prevent race conditions
- Separate keys for cell membership and driver details

### Key Schema

```
match:h3:cell:{h3_index}          # Set of driver IDs in this cell
match:driver:available:{driver_id} # Hash with driver details
match:driver:location:{driver_id}  # GeoHash for precise location
```

### Data Structures

```typescript
// Cell membership (Set)
SADD match:h3:cell:8928308280fffff driver_123

// Driver details (Hash)
HSET match:driver:available:driver_123
  status "AVAILABLE"
  vehicle_type "SEDAN"
  rating 4.8
  last_update 1711324800

// Location (Geo)
GEOADD match:driver:location:driver_123 44.3661 33.3152 driver_123
```

### Matching Algorithm
1. Get rider's H3 cell at resolution 8
2. Get k-ring of cells (radius 1-3 based on demand)
3. SUNION all driver sets from cells
4. Filter by vehicle type, rating, availability
5. SETNX to atomically claim driver
6. Remove from all cells on successful claim

---

## 8. Idempotency Implementation

### Decision
Use event ID + consumer name as idempotency key stored in Redis with TTL.

### Rationale
- Prevents duplicate processing from at-least-once delivery
- Redis provides fast lookup with automatic expiry
- Consumer-specific keys allow same event to be processed by multiple services
- TTL matches stream retention to avoid unbounded growth

### Implementation

```typescript
const IDEMPOTENCY_TTL = 7 * 24 * 60 * 60; // 7 days

async function processIdempotent(
  redis: Redis,
  eventId: string,
  consumerName: string,
  handler: () => Promise<void>
): Promise<boolean> {
  const key = `idempotency:${consumerName}:${eventId}`;
  
  // Try to set key (returns 1 if new, 0 if exists)
  const isNew = await redis.setnx(key, Date.now().toString());
  
  if (!isNew) {
    // Already processed
    return false;
  }
  
  // Set TTL
  await redis.expire(key, IDEMPOTENCY_TTL);
  
  // Process
  await handler();
  return true;
}
```

---

## 9. Service Startup and Graceful Shutdown

### Decision
Register NATS handlers on module init; drain connections on shutdown.

### Rationale
- NestJS lifecycle hooks provide clean integration points
- Draining ensures in-flight messages complete before shutdown
- Health checks should reflect NATS connection status
- Consumers should pause before drain to prevent new message acceptance

### NestJS Integration

```typescript
@Module({})
export class NatsModule implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Connect to NATS
    await this.natsService.connect();
    
    // Register JetStream consumers
    await this.registerConsumers();
    
    // Register request handlers
    await this.registerResponders();
  }
  
  async onModuleDestroy() {
    // Stop accepting new messages
    await this.pauseConsumers();
    
    // Wait for in-flight to complete (max 10s)
    await this.drainWithTimeout(10000);
    
    // Close connection
    await this.natsService.close();
  }
}
```

---

## 10. Monitoring and Alerting

### Decision
Expose NATS metrics via Prometheus; alert on consumer lag and DLQ growth.

### Rationale
- Prometheus integration aligns with existing observability stack
- Consumer lag indicates processing bottlenecks
- DLQ growth indicates systematic failures
- Stream storage metrics prevent disk exhaustion

### Key Metrics

```
# Consumer lag (messages behind)
nats_consumer_pending_messages{stream, consumer}

# Processing rate
nats_consumer_messages_processed_total{stream, consumer}

# DLQ size
nats_stream_messages_total{stream="AIN_RIDER_DLQ"}

# Publish rate
nats_publish_messages_total{subject}

# Request/reply latency
nats_request_duration_seconds{subject}
```

### Alert Rules

```yaml
- alert: NatsConsumerLagHigh
  expr: nats_consumer_pending_messages > 100
  for: 5m
  labels:
    severity: warning

- alert: NatsDLQGrowing
  expr: increase(nats_stream_messages_total{stream="AIN_RIDER_DLQ"}[1h]) > 10
  labels:
    severity: critical

- alert: NatsRequestTimeout
  expr: rate(nats_request_errors_total{error="timeout"}[5m]) > 0.1
  labels:
    severity: warning
```

---

## Summary

All research items resolved. Key decisions:

1. **Two streams** by retention policy (ops: 7d, financial: 30d)
2. **Durable pull consumers** with explicit ack and 3 max retries
3. **DLQ stream** for failed messages with alerting
4. **5-second timeout** for admin request/reply operations
5. **Version field in payload** for schema evolution
6. **W3C trace-context headers** for distributed tracing
7. **H3 + Redis** for driver pool with atomic claiming
8. **Redis idempotency keys** with TTL matching retention
9. **NestJS lifecycle hooks** for clean startup/shutdown
10. **Prometheus metrics** with lag and DLQ alerts
