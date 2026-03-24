# Feature Specification: NATS Inter-Service Communication Refactor

**Feature Branch**: `002-nats-interservice-refactor`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "ain-rider inter-service communication refactor - migrate all inter-service communication to NATS JetStream and NATS Core request/reply patterns, eliminating direct HTTP calls between services and enforcing strict database ownership boundaries"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trip Request Flow via Event-Driven Architecture (Priority: P1)

A rider requests a trip through the mobile app. The system processes this request entirely through asynchronous messaging, matching the rider with an available driver and notifying all relevant parties in real-time without any direct service-to-service HTTP calls.

**Why this priority**: This is the core business flow of the ride-hailing platform. Every revenue-generating transaction depends on this working correctly. It validates the entire event-driven architecture.

**Independent Test**: Can be fully tested by requesting a trip and observing the complete flow from request → match → driver notification → trip start → completion → payment, all via message streams.

**Acceptance Scenarios**:

1. **Given** a rider with a valid account and a driver online in the area, **When** the rider requests a trip, **Then** trip-service publishes `ain_rider.trip_requested` and match-service consumes it to find a driver
2. **Given** match-service finds an available driver, **When** it publishes `ain_rider.trip_matched`, **Then** trip-service consumes this event and updates trip status to MATCHED
3. **Given** a trip is matched, **When** the driver accepts and starts the trip, **Then** trip-service publishes `ain_rider.trip_started` and websocket-server fans out to rider/driver clients
4. **Given** a trip is completed, **When** trip-service publishes `ain_rider.trip_completed`, **Then** payment-service consumes it and creates a payment record

---

### User Story 2 - Admin Operations via Request/Reply Pattern (Priority: P2)

An admin user performs management operations (suspend user, cancel trip, process refund) through the dashboard. These operations use synchronous request/reply messaging to provide immediate feedback while maintaining service isolation.

**Why this priority**: Admin operations require immediate confirmation of success/failure. This validates the NATS Core request/reply pattern for synchronous cross-service mutations.

**Independent Test**: Can be tested by performing admin actions and verifying immediate response with correct state changes across services.

**Acceptance Scenarios**:

1. **Given** an admin viewing a user profile, **When** they suspend the user, **Then** admin-service sends `user.suspend.request` via NATS Core and receives confirmation within 5 seconds
2. **Given** an admin viewing an active trip, **When** they cancel the trip, **Then** admin-service sends `trip.cancel.request` and receives confirmation with updated trip status
3. **Given** an admin processing a refund, **When** they submit the refund request, **Then** admin-service sends `payment.refund.request` and receives confirmation of refund processing

---

### User Story 3 - Real-Time Location Updates and Driver Matching (Priority: P2)

Drivers continuously send GPS location updates while online. The system stores these locations and uses them for efficient driver matching when trip requests arrive, all without any direct HTTP calls between services.

**Why this priority**: Location tracking is fundamental to the matching algorithm and real-time map updates. This validates the Redis + JetStream pattern for high-frequency data.

**Independent Test**: Can be tested by simulating driver location updates and verifying they appear in Redis, are published to JetStream, and are received by websocket clients.

**Acceptance Scenarios**:

1. **Given** a driver is online, **When** they send a GPS update, **Then** location-service writes to Redis and publishes `ain_rider.location_update`
2. **Given** location updates are being published, **When** websocket-server receives them, **Then** it fans out to subscribed rider clients viewing the map
3. **Given** a trip is requested, **When** match-service searches for drivers, **Then** it reads driver locations exclusively from Redis H3 cells

---

### User Story 4 - User Lifecycle Events Propagation (Priority: P3)

When user accounts are created, updated, or status-changed in auth-service, all dependent services receive these events to maintain their local shadow data or trigger workflows.

**Why this priority**: Ensures data consistency across services without direct database access. Foundation for audit trails and compliance.

**Independent Test**: Can be tested by creating/updating users and verifying events are received by all subscribing services.

**Acceptance Scenarios**:

1. **Given** a new user registers, **When** auth-service creates the account, **Then** it publishes `ain_rider.user_created` and all services with shadow tables receive it
2. **Given** a user is suspended, **When** auth-service updates status, **Then** it publishes `ain_rider.user_status_changed` and dependent services react accordingly
3. **Given** a user updates their profile, **When** auth-service saves changes, **Then** it publishes `ain_rider.user_updated` for downstream synchronization

---

### User Story 5 - Payment Processing and Wallet Operations (Priority: P3)

When trips complete, payments are automatically processed. Wallet operations (top-ups, withdrawals) are handled asynchronously with proper event notifications for audit and user feedback.

**Why this priority**: Financial operations must be reliable and auditable. This validates the payment event flow and wallet state management.

**Independent Test**: Can be tested by completing trips and verifying payment records are created and wallet balances updated.

**Acceptance Scenarios**:

1. **Given** a trip is completed, **When** payment-service receives `ain_rider.trip_completed`, **Then** it creates a Payment record and publishes `ain_rider.payment_processed`
2. **Given** a driver requests withdrawal, **When** payment-service processes it, **Then** it publishes `ain_rider.withdrawal_requested` followed by `ain_rider.withdrawal_processed`
3. **Given** a wallet balance changes, **When** payment-service updates it, **Then** it publishes `ain_rider.wallet_updated` for real-time UI updates

---

### User Story 6 - Emergency SOS Handling (Priority: P3)

When a rider or driver triggers an SOS during a trip, the system immediately notifies all relevant parties (admin, support, emergency contacts) through the event system.

**Why this priority**: Safety-critical feature that must work reliably. Validates high-priority event handling.

**Independent Test**: Can be tested by triggering SOS and verifying all notification channels receive the alert.

**Acceptance Scenarios**:

1. **Given** an active trip, **When** rider triggers SOS, **Then** trip-service publishes `ain_rider.sos_created` immediately
2. **Given** SOS is published, **When** websocket-server receives it, **Then** it fans out to admin dashboard and support clients
3. **Given** SOS is resolved, **When** admin marks it resolved, **Then** trip-service publishes `ain_rider.sos_resolved`

---

### Edge Cases

- What happens when NATS JetStream is temporarily unavailable? Services must implement retry with exponential backoff and local buffering for critical events.
- How does the system handle message delivery failures? All JetStream consumers must explicitly ack()/nak() - no auto-ack allowed.
- What happens when a consumer falls behind on message processing? Implement consumer lag monitoring and alerting.
- How are duplicate messages handled? All event handlers must be idempotent.
- What happens when match-service finds no available drivers? Publish a `ain_rider.trip_no_match` event and implement retry logic with expanding search radius.
- How does admin-service handle request timeout? 5-second timeout with clear error response to dashboard.
- What happens when Redis is unavailable for location writes? Fail fast with error, do not block location updates indefinitely.

## Requirements *(mandatory)*

### Functional Requirements

#### API Gateway
- **FR-001**: API Gateway MUST maintain HTTP proxy to all downstream services without change
- **FR-002**: API Gateway MUST NOT directly access Redis, NATS, or any database

#### Auth Service
- **FR-003**: Auth-service MUST publish `ain_rider.user_created` via JetStream after user registration
- **FR-004**: Auth-service MUST publish `ain_rider.user_updated` via JetStream after profile updates
- **FR-005**: Auth-service MUST publish `ain_rider.user_status_changed` via JetStream after status changes
- **FR-006**: Auth-service MUST publish `ain_rider.user_deleted` via JetStream after account deletion
- **FR-007**: Auth-service MUST register NATS Core responders for `user.suspend.request`, `user.activate.request`, `user.update.request` on module initialization

#### Trip Service
- **FR-008**: Trip-service MUST publish `ain_rider.trip_requested` via JetStream when a trip is created
- **FR-009**: Trip-service MUST publish `ain_rider.trip_started` via JetStream when driver starts trip
- **FR-010**: Trip-service MUST publish `ain_rider.trip_completed` via JetStream when trip ends
- **FR-011**: Trip-service MUST publish `ain_rider.trip_cancelled` via JetStream when trip is cancelled
- **FR-012**: Trip-service MUST publish `ain_rider.sos_created` and `ain_rider.sos_resolved` via JetStream for emergency events
- **FR-013**: Trip-service MUST consume `ain_rider.trip_matched` from JetStream, update status to MATCHED, then ack() - no re-publish
- **FR-014**: Trip-service MUST register NATS Core responders for `trip.create.request`, `trip.cancel.request`, `trip.assign_driver.request`, `trip.update_status.request`

#### Match Service
- **FR-015**: Match-service MUST consume `ain_rider.trip_requested` from JetStream
- **FR-016**: Match-service MUST perform H3 ring search against Redis to find available drivers
- **FR-017**: Match-service MUST publish `ain_rider.trip_matched` via JetStream when driver is found
- **FR-018**: Match-service MUST read/write driver pool exclusively via Redis keys: `match:h3:cell:{h3}`, `match:driver:available:{id}`
- **FR-019**: Match-service MUST NOT make any direct HTTP calls to trip-service

#### Payment Service
- **FR-020**: Payment-service MUST consume `ain_rider.trip_completed` from JetStream
- **FR-021**: Payment-service MUST create Payment record and publish `ain_rider.payment_processed` after processing
- **FR-022**: Payment-service MUST publish `ain_rider.wallet_updated` via JetStream after wallet balance changes
- **FR-023**: Payment-service MUST publish `ain_rider.withdrawal_requested` and `ain_rider.withdrawal_processed` via JetStream
- **FR-024**: Payment-service MUST register NATS Core responders for `payment.refund.request`, `payment.adjust.request`

#### Admin Service
- **FR-025**: Admin-service MUST use NATS Core `nc.request()` with 5-second timeout for all cross-service mutations
- **FR-026**: Admin-service MAY perform direct Prisma reads against `ainrider_auth` and `ainrider_trip` databases for list/detail queries only
- **FR-027**: Admin-service MUST NOT perform cross-database writes
- **FR-028**: Admin-service MUST publish `ain_rider.notification_sent` via JetStream after sending notifications
- **FR-029**: Admin-service MUST publish `ain_rider.complaint_created` and `ain_rider.complaint_updated` via JetStream

#### Location Service
- **FR-030**: Location-service MUST write GPS updates to Redis pipeline: `driver:location:{id}`, `h3:drivers:{h3}`
- **FR-031**: Location-service MUST insert location data into TimescaleDB on every update
- **FR-032**: Location-service MUST publish `ain_rider.location_update` via JetStream after each write
- **FR-033**: Location-service MUST NOT communicate with other services except via JetStream publish

#### WebSocket Server
- **FR-034**: WebSocket-server MUST be a pure JetStream consumer - never publishes events
- **FR-035**: WebSocket-server MUST subscribe to: `ain_rider.location_update`, `ain_rider.trip_matched`, `ain_rider.trip_started`, `ain_rider.trip_completed`, `ain_rider.trip_cancelled`, `ain_rider.payment_processed`, `ain_rider.sos_created`, `ain_rider.notification_sent`
- **FR-036**: WebSocket-server MUST fan out each received event to the correct ConnectionStore key for client delivery

#### Global Rules
- **FR-037**: No service MUST call another service's database except admin-service (reads only)
- **FR-038**: No service MUST HTTP-call a sibling service - all runtime inter-service communication MUST go through NATS
- **FR-039**: Redis MUST be used for state only, never as a message bus
- **FR-040**: All JetStream consumers MUST explicitly ack()/nak() - no auto-ack allowed
- **FR-041**: All event handlers MUST be idempotent to handle potential duplicate deliveries

#### Stream Configuration
- **FR-042**: JetStream streams MUST retain operational events (trip, location, user) for 7 days
- **FR-043**: JetStream streams MUST retain financial events (payment, wallet, withdrawal) for 30 days
- **FR-044**: All JetStream consumers MUST use at-least-once delivery semantics

#### Dead Letter Queue
- **FR-045**: Failed messages MUST be moved to a DLQ stream after 3 retry attempts
- **FR-046**: DLQ events MUST trigger alerts to the ops team for manual review
- **FR-047**: DLQ messages MUST include original subject, payload, error reason, and retry count

#### Event Payload Standards
- **FR-048**: All event payloads MUST include a `version` field for schema versioning
- **FR-049**: Payload schema changes MUST be backward-compatible (additive only)
- **FR-050**: All NATS messages MUST include W3C trace-context headers for distributed tracing

### Key Entities

- **JetStream Stream**: Durable message stream for event persistence and replay. Contains subjects like `ain_rider.*` for all domain events.
- **JetStream Consumer**: Durable or ephemeral subscriber to a stream. Each service has dedicated consumers for relevant subjects.
- **NATS Core Request/Reply**: Synchronous request pattern for admin operations requiring immediate response. Uses subjects like `*.request`.
- **Event Payload**: Standardized message format containing event type, timestamp, trace ID, and domain-specific data.
- **Redis Driver Pool**: H3-indexed driver availability state. Keys: `match:h3:cell:{h3}` (set of driver IDs), `match:driver:available:{id}` (driver details).
- **ConnectionStore**: WebSocket connection registry mapping user IDs to active socket connections for event fan-out.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All inter-service mutations complete via NATS messaging with no direct HTTP calls between backend services
- **SC-002**: Admin operations (suspend, cancel, refund) receive response within 5 seconds via request/reply pattern
- **SC-003**: Trip request to driver match notification completes within 3 seconds under normal load
- **SC-004**: Location updates propagate from driver app to rider map within 500ms
- **SC-005**: System handles 1000 concurrent active trips without message backlog exceeding 100 messages
- **SC-006**: All JetStream consumers maintain explicit ack/nak with zero auto-ack configurations
- **SC-007**: Zero direct database queries from services to databases they don't own (except admin-service reads)
- **SC-008**: Event handlers demonstrate idempotency - processing same event twice produces identical state
- **SC-009**: System recovers from NATS unavailability within 30 seconds with no message loss for durable streams
- **SC-010**: Match-service performs driver search exclusively via Redis with no HTTP calls to other services

## Clarifications

### Session 2026-03-24

- Q: JetStream message retention policy? → A: Retain by time (7 days for operational events, 30 days for financial events)
- Q: Consumer delivery semantics? → A: At-least-once delivery (retry until ack, duplicates possible - handlers must be idempotent)
- Q: Event payload schema versioning strategy? → A: Version field in payload with backward-compatible evolution
- Q: Dead letter queue strategy for failed messages? → A: Move to DLQ stream after 3 retries, alert ops team for manual review
- Q: Distributed tracing propagation via NATS? → A: TraceId in NATS message headers (standard W3C trace-context format)

## Assumptions

- NATS JetStream is already deployed and accessible to all services
- Redis cluster is available for location and driver pool state
- TimescaleDB is configured for location history storage
- All services have the `@ain-rider/nats-client` package available
- H3 library is available for geospatial indexing
- WebSocket server has ConnectionStore implementation for client management
