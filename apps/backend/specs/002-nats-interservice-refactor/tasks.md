# Tasks: NATS Inter-Service Communication Refactor

**Input**: Design documents from `/specs/002-nats-interservice-refactor/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/nats-subjects.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: NATS JetStream infrastructure and shared package setup

- [ ] T001 Create JetStream streams by running setup script in `packages/nats-client/scripts/setup-streams.ts`
  - Create stream `AIN_RIDER_OPS` with subjects: `ain_rider.trip_*`, `ain_rider.user_*`, `ain_rider.location_*`, `ain_rider.sos_*`, `ain_rider.notification_*`, `ain_rider.complaint_*`
  - Set retention: 7 days, storage: file, replicas: 3
  - Create stream `AIN_RIDER_FINANCIAL` with subjects: `ain_rider.payment_*`, `ain_rider.wallet_*`, `ain_rider.withdrawal_*`
  - Set retention: 30 days, storage: file, replicas: 3
  - Create stream `AIN_RIDER_DLQ` with subjects: `ain_rider.dlq.*`
  - Set retention: 30 days, storage: file, replicas: 3

- [ ] T002 [P] Create JetStream consumers for each service in `packages/nats-client/scripts/setup-consumers.ts`
  - Consumer `trip-matched-consumer` on `AIN_RIDER_OPS` filtering `ain_rider.trip_matched` with max_deliver=3, ack_wait=30s
  - Consumer `trip-requested-consumer` on `AIN_RIDER_OPS` filtering `ain_rider.trip_requested` with max_deliver=3, ack_wait=30s
  - Consumer `trip-completed-consumer` on `AIN_RIDER_FINANCIAL` filtering `ain_rider.trip_completed` with max_deliver=3, ack_wait=30s
  - Consumer `ws-location-consumer` on `AIN_RIDER_OPS` filtering `ain_rider.location_update` with max_deliver=1, ack_wait=5s
  - Consumer `ws-trip-consumer` on `AIN_RIDER_OPS` filtering `ain_rider.trip_*` with max_deliver=1, ack_wait=5s
  - Consumer `ws-payment-consumer` on `AIN_RIDER_FINANCIAL` filtering `ain_rider.payment_processed` with max_deliver=1, ack_wait=5s
  - Consumer `ws-sos-consumer` on `AIN_RIDER_OPS` filtering `ain_rider.sos_*` with max_deliver=1, ack_wait=5s

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core NATS utilities in shared package that ALL services depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Event Envelope and Types

- [ ] T003 Create event envelope interface in `packages/nats-client/src/types/event-envelope.ts`
  - Define `EventEnvelope<T>` interface with fields: version (number), eventType (string), eventId (string), timestamp (string), traceId (string), source (string), data (T)
  - Export type for use across all services

- [ ] T004 [P] Create all event payload types in `packages/nats-client/src/types/events/index.ts`
  - Create `packages/nats-client/src/types/events/trip-events.ts` with: TripRequestedEvent, TripMatchedEvent, TripStartedEvent, TripCompletedEvent, TripCancelledEvent, TripNoMatchEvent
  - Create `packages/nats-client/src/types/events/sos-events.ts` with: SOSCreatedEvent, SOSResolvedEvent
  - Create `packages/nats-client/src/types/events/user-events.ts` with: UserCreatedEvent, UserUpdatedEvent, UserStatusChangedEvent, UserDeletedEvent
  - Create `packages/nats-client/src/types/events/location-events.ts` with: LocationUpdateEvent
  - Create `packages/nats-client/src/types/events/payment-events.ts` with: PaymentProcessedEvent, WalletUpdatedEvent, WithdrawalRequestedEvent, WithdrawalProcessedEvent
  - Create `packages/nats-client/src/types/events/notification-events.ts` with: NotificationSentEvent
  - Create `packages/nats-client/src/types/events/complaint-events.ts` with: ComplaintCreatedEvent, ComplaintUpdatedEvent
  - Create index.ts that re-exports all event types
  - Use exact field definitions from data-model.md

- [ ] T005 [P] Create request/reply types in `packages/nats-client/src/types/requests/index.ts`
  - Create `packages/nats-client/src/types/requests/user-requests.ts` with: SuspendUserRequest, SuspendUserResponse, ActivateUserRequest, ActivateUserResponse
  - Create `packages/nats-client/src/types/requests/trip-requests.ts` with: CancelTripRequest, CancelTripResponse, AssignDriverRequest, AssignDriverResponse
  - Create `packages/nats-client/src/types/requests/payment-requests.ts` with: RefundRequest, RefundResponse, AdjustPaymentRequest, AdjustPaymentResponse
  - Define NatsRequest<T> wrapper with: traceId, requestedBy, timestamp, data
  - Define NatsResponse<T> wrapper with: success, traceId, data?, error?
  - Create index.ts that re-exports all request types

- [ ] T006 [P] Create DLQ message type in `packages/nats-client/src/types/dlq-message.ts`
  - Define DLQMessage interface with: originalSubject, originalPayload, originalHeaders, errorReason, errorStack?, retryCount, consumerName, failedAt, traceId

### JetStream Publisher

- [ ] T007 Create JetStream publisher service in `packages/nats-client/src/jetstream/publisher.ts`
  - Create `JetStreamPublisher` class that wraps JetStreamClient
  - Implement `publish<T>(subject: string, data: T, traceId?: string): Promise<PubAck>` method
  - Auto-generate eventId using randomUUID()
  - Auto-set timestamp to ISO string
  - Set source from SERVICE_NAME env var
  - Add W3C traceparent header: `00-{traceId}-{spanId}-01`
  - Add Nats-Msg-Id header for deduplication
  - Wrap payload in EventEnvelope before publishing
  - Log publish success/failure with subject and traceId

### JetStream Consumer Base

- [ ] T008 Create JetStream consumer base class in `packages/nats-client/src/jetstream/consumer.ts`
  - Create abstract `JetStreamConsumer` class
  - Constructor takes: NatsConnection, streamName, consumerName, filterSubject
  - Implement `start(): Promise<void>` that gets consumer and starts consuming
  - Implement abstract `handleMessage(envelope: EventEnvelope<unknown>, msg: JsMsg): Promise<void>`
  - Implement `stop(): Promise<void>` that closes subscription
  - Auto-extract traceId from headers or envelope
  - Call handleMessage in try/catch, nak() on error
  - Log message processing with traceId

### Idempotency Service

- [ ] T009 Create idempotency service in `packages/nats-client/src/idempotency/idempotency.service.ts`
  - Create `IdempotencyService` class that takes Redis client
  - Implement `isProcessed(consumerName: string, eventId: string): Promise<boolean>` using Redis EXISTS
  - Implement `markProcessed(consumerName: string, eventId: string): Promise<void>` using Redis SETEX with 7-day TTL
  - Key format: `idempotency:{consumerName}:{eventId}`

### DLQ Service

- [ ] T010 Create DLQ service in `packages/nats-client/src/dlq/dlq.service.ts`
  - Create `DLQService` class that takes JetStreamClient
  - Implement `sendToDLQ(originalSubject, originalPayload, errorReason, retryCount, consumerName, traceId): Promise<void>`
  - Publish to subject `ain_rider.dlq.{originalSubject without ain_rider. prefix}`
  - Log error with [DLQ] prefix including subject, consumerName, traceId
  - Include errorStack from new Error().stack

### Request/Reply Client

- [ ] T011 Create NATS request client in `packages/nats-client/src/request-reply/request-client.ts`
  - Create `NatsRequestClient` class that takes NatsConnection
  - Implement `request<TReq, TRes>(subject: string, data: TReq, traceId: string, timeoutMs?: number): Promise<TRes>`
  - Default timeout: 5000ms
  - Wrap data in NatsRequest envelope with traceId, requestedBy, timestamp
  - Parse response as NatsResponse<TRes>
  - If response.success is false, throw error with response.error.message
  - Catch TIMEOUT and NO_RESPONDERS errors, throw ServiceUnavailableError
  - Log request/response with subject and traceId

### Request/Reply Responder Base

- [ ] T012 Create NATS responder base class in `packages/nats-client/src/request-reply/responder.ts`
  - Create abstract `NatsResponder` class
  - Constructor takes: NatsConnection, subject
  - Implement `start(): Promise<void>` that subscribes to subject
  - Implement abstract `handleRequest(request: NatsRequest<unknown>): Promise<NatsResponse<unknown>>`
  - Auto-respond with JSON stringified NatsResponse
  - Wrap handler in try/catch, respond with error on failure
  - Log request handling with subject and traceId

### Tracing Utilities

- [ ] T013 [P] Create tracing utilities in `packages/nats-client/src/tracing/trace-context.ts`
  - Implement `generateTraceId(): string` using randomUUID without dashes
  - Implement `generateSpanId(): string` using randomUUID first 16 chars
  - Implement `createTraceparent(traceId: string): string` returning `00-{traceId}-{spanId}-01`
  - Implement `extractTraceId(headers: MsgHdrs): string | undefined` parsing traceparent header
  - Implement `extractOrGenerateTraceId(headers?: MsgHdrs): string` with fallback

### Package Exports

- [ ] T014 Update package exports in `packages/nats-client/src/index.ts`
  - Export all types from types/
  - Export JetStreamPublisher from jetstream/publisher
  - Export JetStreamConsumer from jetstream/consumer
  - Export IdempotencyService from idempotency/
  - Export DLQService from dlq/
  - Export NatsRequestClient from request-reply/request-client
  - Export NatsResponder from request-reply/responder
  - Export all tracing utilities from tracing/

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Trip Request Flow (Priority: P1) 🎯 MVP

**Goal**: Implement the complete trip request → match → start → complete → payment flow via JetStream events

**Independent Test**: Request a trip, verify trip_requested event published, match-service consumes and publishes trip_matched, trip-service updates status, payment-service creates payment on completion

### Trip Service - Event Publishers

- [ ] T015 [US1] Create trip event publisher in `apps/nest/trip-service/src/events/trip-event.publisher.ts`
  - Inject NatsService and create JetStreamPublisher instance
  - Implement `publishTripRequested(trip: Trip, traceId: string): Promise<void>`
    - Build TripRequestedEvent from trip entity
    - Publish to `ain_rider.trip_requested`
  - Implement `publishTripStarted(trip: Trip, traceId: string): Promise<void>`
    - Build TripStartedEvent from trip entity
    - Publish to `ain_rider.trip_started`
  - Implement `publishTripCompleted(trip: Trip, traceId: string): Promise<void>`
    - Build TripCompletedEvent from trip entity with fare, distance, duration
    - Publish to `ain_rider.trip_completed`
  - Implement `publishTripCancelled(trip: Trip, cancelledBy: string, reason: string, traceId: string): Promise<void>`
    - Build TripCancelledEvent
    - Publish to `ain_rider.trip_cancelled`

- [ ] T016 [US1] Integrate trip publisher into TripService in `apps/nest/trip-service/src/trip/trip.service.ts`
  - Inject TripEventPublisher
  - After creating trip in `createTrip()`, call `publishTripRequested()`
  - After updating trip status to STARTED in `startTrip()`, call `publishTripStarted()`
  - After updating trip status to COMPLETED in `completeTrip()`, call `publishTripCompleted()`
  - After updating trip status to CANCELLED in `cancelTrip()`, call `publishTripCancelled()`
  - Pass traceId from request context to all publish calls

### Trip Service - Trip Matched Consumer

- [ ] T017 [US1] Create trip matched consumer in `apps/nest/trip-service/src/consumers/trip-matched.consumer.ts`
  - Extend JetStreamConsumer base class
  - Set streamName: 'AIN_RIDER_OPS', consumerName: 'trip-matched-consumer', filterSubject: 'ain_rider.trip_matched'
  - Inject IdempotencyService and TripService
  - In handleMessage():
    - Check idempotency with eventId
    - If already processed, ack() and return
    - Extract TripMatchedEvent from envelope.data
    - Call tripService.updateTripStatus(tripId, 'MATCHED', { driverId, vehicleId, estimatedArrival })
    - Mark as processed in idempotency service
    - ack() the message
  - On error: log error, nak() for retry

- [ ] T018 [US1] Register trip matched consumer in TripModule in `apps/nest/trip-service/src/trip/trip.module.ts`
  - Add TripMatchedConsumer to providers
  - Implement OnModuleInit to call consumer.start()
  - Implement OnModuleDestroy to call consumer.stop()

### Match Service - Trip Requested Consumer

- [ ] T019 [US1] Create trip requested consumer in `apps/nest/match-service/src/consumers/trip-requested.consumer.ts`
  - Extend JetStreamConsumer base class
  - Set streamName: 'AIN_RIDER_OPS', consumerName: 'trip-requested-consumer', filterSubject: 'ain_rider.trip_requested'
  - Inject IdempotencyService, MatchService, and JetStreamPublisher
  - In handleMessage():
    - Check idempotency with eventId
    - If already processed, ack() and return
    - Extract TripRequestedEvent from envelope.data
    - Call matchService.findDriver(pickupLocation.h3Index, vehicleType)
    - If driver found:
      - Build TripMatchedEvent with tripId, riderId, driverId, vehicleId, estimatedArrival
      - Publish to `ain_rider.trip_matched`
    - If no driver found:
      - Build TripNoMatchEvent with tripId, riderId, reason: 'NO_DRIVERS'
      - Publish to `ain_rider.trip_no_match`
    - Mark as processed in idempotency service
    - ack() the message
  - On error: log error, nak() for retry

- [ ] T020 [US1] Create match service Redis operations in `apps/nest/match-service/src/redis/driver-pool.service.ts`
  - Inject Redis client
  - Implement `findAvailableDrivers(h3Index: string, radius: number): Promise<string[]>`
    - Use H3 kRing to get neighboring cells
    - SUNION all `match:h3:cell:{cell}` sets
    - Return array of driver IDs
  - Implement `getDriverDetails(driverId: string): Promise<DriverDetails | null>`
    - HGETALL `match:driver:available:{driverId}`
    - Return parsed driver details or null
  - Implement `claimDriver(tripId: string, driverId: string): Promise<boolean>`
    - SETNX `trip:matching:{tripId}` with driverId, TTL 30s
    - If successful, remove driver from all H3 cells
    - Return true if claimed, false if already claimed
  - Implement `releaseDriver(tripId: string, driverId: string, h3Index: string): Promise<void>`
    - DEL `trip:matching:{tripId}`
    - SADD driver back to `match:h3:cell:{h3Index}`

- [ ] T021 [US1] Implement match service in `apps/nest/match-service/src/match/match.service.ts`
  - Inject DriverPoolService
  - Implement `findDriver(h3Index: string, vehicleType: string): Promise<MatchResult | null>`
    - Call findAvailableDrivers with radius 1
    - Filter by vehicleType
    - Sort by rating descending
    - For each candidate, try claimDriver()
    - If claimed, return MatchResult with driverId, vehicleId, estimatedArrival
    - If no driver claimed after all candidates, expand radius and retry up to radius 3
    - Return null if no match

- [ ] T022 [US1] Register trip requested consumer in MatchModule in `apps/nest/match-service/src/match/match.module.ts`
  - Add TripRequestedConsumer to providers
  - Add DriverPoolService to providers
  - Implement OnModuleInit to call consumer.start()
  - Implement OnModuleDestroy to call consumer.stop()

### Payment Service - Trip Completed Consumer

- [ ] T023 [US1] Create trip completed consumer in `apps/nest/payment-service/src/consumers/trip-completed.consumer.ts`
  - Extend JetStreamConsumer base class
  - Set streamName: 'AIN_RIDER_FINANCIAL', consumerName: 'trip-completed-consumer', filterSubject: 'ain_rider.trip_completed'
  - Inject IdempotencyService, PaymentService, and JetStreamPublisher
  - In handleMessage():
    - Check idempotency with eventId
    - If already processed, ack() and return
    - Extract TripCompletedEvent from envelope.data
    - Call paymentService.createPayment(tripId, riderId, driverId, fare)
    - Build PaymentProcessedEvent with paymentId, tripId, riderId, driverId, amount, status: 'COMPLETED'
    - Publish to `ain_rider.payment_processed`
    - Mark as processed in idempotency service
    - ack() the message
  - On error: log error, nak() for retry

- [ ] T024 [US1] Register trip completed consumer in PaymentModule in `apps/nest/payment-service/src/payment/payment.module.ts`
  - Add TripCompletedConsumer to providers
  - Implement OnModuleInit to call consumer.start()
  - Implement OnModuleDestroy to call consumer.stop()

**Checkpoint**: At this point, the complete trip flow works via events: request → match → start → complete → payment

---

## Phase 4: User Story 2 - Admin Operations (Priority: P2)

**Goal**: Implement admin operations (suspend user, cancel trip, refund) via NATS request/reply with 5-second timeout

**Independent Test**: Admin suspends a user via dashboard, verify request sent to auth-service, response received within 5s, user status updated

### Auth Service - User Responders

- [ ] T025 [US2] Create user suspend responder in `apps/nest/auth-service/src/nats/responders/user-suspend.responder.ts`
  - Extend NatsResponder base class
  - Set subject: 'user.suspend.request'
  - Inject UserService
  - In handleRequest():
    - Extract SuspendUserRequest from request.data
    - Call userService.suspendUser(userId, reason, suspendedBy)
    - Return NatsResponse with success: true, data: { userId, newStatus: 'SUSPENDED' }
  - On error: return NatsResponse with success: false, error: { code, message }

- [ ] T026 [P] [US2] Create user activate responder in `apps/nest/auth-service/src/nats/responders/user-activate.responder.ts`
  - Extend NatsResponder base class
  - Set subject: 'user.activate.request'
  - Inject UserService
  - In handleRequest():
    - Extract ActivateUserRequest from request.data
    - Call userService.activateUser(userId, activatedBy)
    - Return NatsResponse with success: true, data: { userId, newStatus: 'ACTIVE' }
  - On error: return NatsResponse with success: false, error: { code, message }

- [ ] T027 [US2] Register user responders in AuthModule in `apps/nest/auth-service/src/auth/auth.module.ts`
  - Add UserSuspendResponder and UserActivateResponder to providers
  - Implement OnModuleInit to call responder.start() for each
  - Implement OnModuleDestroy to call responder.stop() for each

### Trip Service - Trip Responders

- [ ] T028 [US2] Create trip cancel responder in `apps/nest/trip-service/src/nats/responders/trip-cancel.responder.ts`
  - Extend NatsResponder base class
  - Set subject: 'trip.cancel.request'
  - Inject TripService and TripEventPublisher
  - In handleRequest():
    - Extract CancelTripRequest from request.data
    - Call tripService.cancelTrip(tripId, reason, cancelledBy)
    - Publish trip_cancelled event
    - Return NatsResponse with success: true, data: { tripId, newStatus: 'CANCELLED', cancellationFee }
  - On error: return NatsResponse with success: false, error: { code, message }

- [ ] T029 [P] [US2] Create trip assign driver responder in `apps/nest/trip-service/src/nats/responders/trip-assign-driver.responder.ts`
  - Extend NatsResponder base class
  - Set subject: 'trip.assign_driver.request'
  - Inject TripService
  - In handleRequest():
    - Extract AssignDriverRequest from request.data
    - Call tripService.assignDriver(tripId, driverId, assignedBy)
    - Return NatsResponse with success: true, data: { tripId, driverId }
  - On error: return NatsResponse with success: false, error: { code, message }

- [ ] T030 [US2] Register trip responders in TripModule in `apps/nest/trip-service/src/trip/trip.module.ts`
  - Add TripCancelResponder and TripAssignDriverResponder to providers
  - Implement OnModuleInit to call responder.start() for each
  - Implement OnModuleDestroy to call responder.stop() for each

### Payment Service - Payment Responders

- [ ] T031 [US2] Create payment refund responder in `apps/nest/payment-service/src/nats/responders/payment-refund.responder.ts`
  - Extend NatsResponder base class
  - Set subject: 'payment.refund.request'
  - Inject PaymentService and JetStreamPublisher
  - In handleRequest():
    - Extract RefundRequest from request.data
    - Call paymentService.processRefund(paymentId, amount, reason, requestedBy)
    - Publish wallet_updated event for rider
    - Return NatsResponse with success: true, data: { refundId, amount }
  - On error: return NatsResponse with success: false, error: { code, message }

- [ ] T032 [US2] Register payment responders in PaymentModule in `apps/nest/payment-service/src/payment/payment.module.ts`
  - Add PaymentRefundResponder to providers
  - Implement OnModuleInit to call responder.start()
  - Implement OnModuleDestroy to call responder.stop()

### Admin Service - NATS Request Client

- [ ] T033 [US2] Create admin NATS client in `apps/nest/admin-service/src/nats/admin-nats.client.ts`
  - Inject NatsService and create NatsRequestClient instance
  - Implement `suspendUser(userId: string, reason: string, adminId: string, traceId: string): Promise<SuspendUserResponse>`
    - Call requestClient.request('user.suspend.request', { userId, reason, suspendedBy: adminId }, traceId)
  - Implement `activateUser(userId: string, adminId: string, traceId: string): Promise<ActivateUserResponse>`
    - Call requestClient.request('user.activate.request', { userId, activatedBy: adminId }, traceId)
  - Implement `cancelTrip(tripId: string, reason: string, adminId: string, traceId: string): Promise<CancelTripResponse>`
    - Call requestClient.request('trip.cancel.request', { tripId, reason, cancelledBy: adminId }, traceId)
  - Implement `refundPayment(paymentId: string, amount: number, reason: string, adminId: string, traceId: string): Promise<RefundResponse>`
    - Call requestClient.request('payment.refund.request', { paymentId, amount, reason, requestedBy: adminId }, traceId)

- [ ] T034 [US2] Integrate admin NATS client into AdminService in `apps/nest/admin-service/src/admin/admin.service.ts`
  - Inject AdminNatsClient
  - Replace direct HTTP calls with NATS requests:
    - suspendUser() → adminNatsClient.suspendUser()
    - activateUser() → adminNatsClient.activateUser()
    - cancelTrip() → adminNatsClient.cancelTrip()
    - refundPayment() → adminNatsClient.refundPayment()
  - Handle ServiceUnavailableError and return 503 to client

**Checkpoint**: At this point, admin operations work via NATS request/reply with 5s timeout

---

## Phase 5: User Story 3 - Location Updates (Priority: P2)

**Goal**: Driver location updates flow through location-service → Redis → JetStream → websocket-server → rider clients

**Independent Test**: Driver sends GPS update, verify Redis updated, location_update event published, websocket clients receive update

### Location Service - Event Publisher

- [ ] T035 [US3] Create location event publisher in `apps/elysia/location-service/src/events/location-event.publisher.ts`
  - Create JetStreamPublisher instance from NATS connection
  - Implement `publishLocationUpdate(driverId: string, location: Location, heading: number, speed: number, isOnline: boolean, traceId: string): Promise<void>`
    - Build LocationUpdateEvent
    - Publish to `ain_rider.location_update`

- [ ] T036 [US3] Integrate location publisher into location handler in `apps/elysia/location-service/src/handlers/location.handler.ts`
  - After writing to Redis and TimescaleDB, call locationEventPublisher.publishLocationUpdate()
  - Extract traceId from request headers or generate new one

### Location Service - Redis Operations

- [ ] T037 [US3] Update Redis operations in `apps/elysia/location-service/src/redis/driver-location.ts`
  - Implement `updateDriverLocation(driverId: string, lat: number, lng: number, h3Index: string): Promise<void>`
    - Pipeline:
      - GEOADD `driver:location:{driverId}` with lat, lng
      - SADD `h3:drivers:{h3Index}` with driverId
      - HSET `match:driver:available:{driverId}` with status, lastUpdate
    - Execute pipeline atomically
  - Implement `removeDriverFromCell(driverId: string, oldH3Index: string): Promise<void>`
    - SREM `h3:drivers:{oldH3Index}` driverId
  - Track previous H3 cell and remove from old cell when driver moves to new cell

### WebSocket Server - Location Consumer

- [ ] T038 [US3] Create location update consumer in `apps/elysia/websocket-server/src/consumers/location-update.consumer.ts`
  - Create JetStream consumer for `ain_rider.location_update`
  - Set consumerName: 'ws-location-consumer', max_deliver: 1, ack_wait: 5s
  - In message handler:
    - Extract LocationUpdateEvent from envelope.data
    - Get list of riders watching this driver from ConnectionStore
    - For each rider, send WebSocket message: { type: 'location_update', data: { driverId, location, heading, speed } }
    - ack() immediately (don't retry WebSocket fanout failures)

- [ ] T039 [US3] Implement driver watchers in ConnectionStore in `apps/elysia/websocket-server/src/connection-store.ts`
  - Add `watchDriver(riderId: string, driverId: string): void` to track which riders are watching which drivers
  - Add `unwatchDriver(riderId: string, driverId: string): void`
  - Add `getWatchers(driverId: string): string[]` to get all riders watching a driver
  - Store in Map<driverId, Set<riderId>>

**Checkpoint**: At this point, location updates flow from driver → Redis → JetStream → WebSocket → rider

---

## Phase 6: User Story 4 - User Lifecycle Events (Priority: P3)

**Goal**: User create/update/status changes in auth-service publish events for downstream services to sync shadow tables

**Independent Test**: Create a user, verify user_created event published, admin-service shadow table updated

### Auth Service - User Event Publishers

- [ ] T040 [US4] Create user event publisher in `apps/nest/auth-service/src/events/user-event.publisher.ts`
  - Inject NatsService and create JetStreamPublisher instance
  - Implement `publishUserCreated(user: User, traceId: string): Promise<void>`
    - Build UserCreatedEvent from user entity
    - Publish to `ain_rider.user_created`
  - Implement `publishUserUpdated(user: User, changes: object, updatedBy: string, traceId: string): Promise<void>`
    - Build UserUpdatedEvent with changes object
    - Publish to `ain_rider.user_updated`
  - Implement `publishUserStatusChanged(user: User, previousStatus: string, changedBy: string, reason: string, traceId: string): Promise<void>`
    - Build UserStatusChangedEvent
    - Publish to `ain_rider.user_status_changed`
  - Implement `publishUserDeleted(userId: string, deletedBy: string, reason: string, traceId: string): Promise<void>`
    - Build UserDeletedEvent
    - Publish to `ain_rider.user_deleted`

- [ ] T041 [US4] Integrate user publisher into AuthService in `apps/nest/auth-service/src/auth/auth.service.ts`
  - Inject UserEventPublisher
  - After creating user in `register()`, call `publishUserCreated()`
  - After creating user in `adminCreateUser()`, call `publishUserCreated()`
  - After updating user in `updateProfile()`, call `publishUserUpdated()`
  - After updating status in `updateUserStatus()`, call `publishUserStatusChanged()`
  - Pass traceId from request context to all publish calls

**Checkpoint**: At this point, user lifecycle events are published for downstream sync

---

## Phase 7: User Story 5 - Payment Events (Priority: P3)

**Goal**: Payment and wallet operations publish events for real-time UI updates and audit

**Independent Test**: Complete a trip, verify payment_processed event published, wallet_updated event published

### Payment Service - Event Publishers

- [ ] T042 [US5] Create payment event publisher in `apps/nest/payment-service/src/events/payment-event.publisher.ts`
  - Inject NatsService and create JetStreamPublisher instance
  - Implement `publishPaymentProcessed(payment: Payment, traceId: string): Promise<void>`
    - Build PaymentProcessedEvent from payment entity
    - Publish to `ain_rider.payment_processed`
  - Implement `publishWalletUpdated(wallet: Wallet, changeAmount: number, changeType: string, reason: string, referenceId: string, traceId: string): Promise<void>`
    - Build WalletUpdatedEvent
    - Publish to `ain_rider.wallet_updated`
  - Implement `publishWithdrawalRequested(withdrawal: Withdrawal, traceId: string): Promise<void>`
    - Build WithdrawalRequestedEvent
    - Publish to `ain_rider.withdrawal_requested`
  - Implement `publishWithdrawalProcessed(withdrawal: Withdrawal, status: string, transactionRef: string, traceId: string): Promise<void>`
    - Build WithdrawalProcessedEvent
    - Publish to `ain_rider.withdrawal_processed`

- [ ] T043 [US5] Integrate payment publisher into PaymentService in `apps/nest/payment-service/src/payment/payment.service.ts`
  - Inject PaymentEventPublisher
  - After creating payment in `createPayment()`, call `publishPaymentProcessed()`
  - After updating wallet in `updateWalletBalance()`, call `publishWalletUpdated()`
  - After creating withdrawal in `requestWithdrawal()`, call `publishWithdrawalRequested()`
  - After processing withdrawal in `processWithdrawal()`, call `publishWithdrawalProcessed()`
  - Pass traceId from request context to all publish calls

### WebSocket Server - Payment Consumer

- [ ] T044 [US5] Create payment consumer in `apps/elysia/websocket-server/src/consumers/payment.consumer.ts`
  - Create JetStream consumer for `ain_rider.payment_processed`
  - Set consumerName: 'ws-payment-consumer', max_deliver: 1, ack_wait: 5s
  - In message handler:
    - Extract PaymentProcessedEvent from envelope.data
    - Send WebSocket message to riderId: { type: 'payment_processed', data: { paymentId, amount, status } }
    - Send WebSocket message to driverId: { type: 'payment_processed', data: { paymentId, amount, status } }
    - ack() immediately

**Checkpoint**: At this point, payment events flow to WebSocket clients for real-time updates

---

## Phase 8: User Story 6 - SOS Handling (Priority: P3)

**Goal**: SOS events immediately notify admin dashboard and support clients via WebSocket

**Independent Test**: Trigger SOS during trip, verify sos_created event published, admin dashboard receives alert

### Trip Service - SOS Event Publishers

- [ ] T045 [US6] Add SOS event methods to trip event publisher in `apps/nest/trip-service/src/events/trip-event.publisher.ts`
  - Implement `publishSOSCreated(tripId: string, triggeredBy: string, userId: string, location: Location, traceId: string): Promise<void>`
    - Build SOSCreatedEvent with sosId (generated UUID)
    - Publish to `ain_rider.sos_created`
  - Implement `publishSOSResolved(sosId: string, tripId: string, resolvedBy: string, resolution: string, traceId: string): Promise<void>`
    - Build SOSResolvedEvent
    - Publish to `ain_rider.sos_resolved`

- [ ] T046 [US6] Integrate SOS publisher into TripService in `apps/nest/trip-service/src/trip/trip.service.ts`
  - Implement `triggerSOS(tripId: string, triggeredBy: string, userId: string, location: Location, traceId: string): Promise<SOS>`
    - Create SOS record in database
    - Call `publishSOSCreated()`
    - Return SOS entity
  - Implement `resolveSOS(sosId: string, resolvedBy: string, resolution: string, traceId: string): Promise<SOS>`
    - Update SOS record status to RESOLVED
    - Call `publishSOSResolved()`
    - Return SOS entity

### WebSocket Server - SOS Consumer

- [ ] T047 [US6] Create SOS consumer in `apps/elysia/websocket-server/src/consumers/sos.consumer.ts`
  - Create JetStream consumer for `ain_rider.sos_*`
  - Set consumerName: 'ws-sos-consumer', max_deliver: 1, ack_wait: 5s
  - In message handler:
    - Extract event type from subject (sos_created or sos_resolved)
    - Get all admin and support user connections from ConnectionStore
    - For each admin/support, send WebSocket message: { type: 'sos_alert', data: { sosId, tripId, location, status } }
    - ack() immediately

- [ ] T048 [US6] Implement admin user tracking in ConnectionStore in `apps/elysia/websocket-server/src/connection-store.ts`
  - Add `registerAdmin(userId: string, socket: WebSocket): void` for admin/support users
  - Add `getAdminUsers(): string[]` to get all connected admin/support user IDs
  - Track user role when connection is established

**Checkpoint**: At this point, SOS events immediately alert admin dashboard

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### WebSocket Server - Unified Event Fanout

- [ ] T049 Create unified event fanout manager in `apps/elysia/websocket-server/src/consumers/event-fanout.ts`
  - Create EventFanout class that manages all consumers
  - Implement `start(): Promise<void>` that starts all consumers
  - Implement `stop(): Promise<void>` that stops all consumers
  - Register in main application startup

### Trip Consumer for WebSocket

- [ ] T050 [P] Create trip events consumer in `apps/elysia/websocket-server/src/consumers/trip.consumer.ts`
  - Create JetStream consumer for `ain_rider.trip_*`
  - Set consumerName: 'ws-trip-consumer', max_deliver: 1, ack_wait: 5s
  - Handle trip_matched, trip_started, trip_completed, trip_cancelled
  - Fan out to riderId and driverId for each event
  - ack() immediately

### Graceful Shutdown

- [ ] T051 Implement graceful shutdown in all NestJS services
  - In each service's main module, implement OnModuleDestroy
  - Stop all consumers first (pause accepting new messages)
  - Wait for in-flight messages to complete (max 10s timeout)
  - Close NATS connection
  - Log shutdown progress

### Metrics and Monitoring

- [ ] T052 [P] Add NATS metrics to Prometheus in `packages/nats-client/src/metrics/nats-metrics.ts`
  - Create `nats_publish_messages_total` counter with subject label
  - Create `nats_consumer_messages_processed_total` counter with stream, consumer labels
  - Create `nats_consumer_pending_messages` gauge with stream, consumer labels
  - Create `nats_request_duration_seconds` histogram with subject label
  - Create `nats_request_errors_total` counter with subject, error labels

- [ ] T053 [P] Add DLQ alerting in `packages/nats-client/src/dlq/dlq.service.ts`
  - After publishing to DLQ, increment `nats_dlq_messages_total` counter
  - Log at ERROR level with structured context for alerting

### Documentation

- [ ] T054 [P] Update README with NATS setup instructions in `README.md`
  - Add section on running NATS JetStream locally
  - Document stream and consumer setup
  - Add troubleshooting guide for common NATS issues

- [ ] T055 [P] Create NATS architecture diagram in `docs/nats-architecture.md`
  - Show all services and their event flows
  - Document subject naming conventions
  - List all consumers and their configurations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Independent
- **User Story 6 (P3)**: Can start after Foundational (Phase 2) - Independent

### Within Each User Story

- Event types must be defined before publishers
- Publishers before consumers
- Consumers before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel
- All tasks marked [P] within a story can run in parallel

---

## Parallel Example: User Story 1

```bash
# After Foundational complete, launch all US1 tasks in parallel where marked [P]:

# Sequential (dependencies):
Task T015: Create trip event publisher (must be first)
Task T016: Integrate trip publisher into TripService (depends on T015)
Task T017: Create trip matched consumer (can parallel with T019-T022)
Task T018: Register trip matched consumer (depends on T017)

# Parallel group (different services):
Task T019: Create trip requested consumer in match-service
Task T020: Create match service Redis operations
Task T021: Implement match service
Task T022: Register trip requested consumer

# Parallel group (payment service):
Task T023: Create trip completed consumer
Task T024: Register trip completed consumer
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T014)
3. Complete Phase 3: User Story 1 (T015-T024)
4. **STOP and VALIDATE**: Test complete trip flow via events
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test trip flow → Deploy/Demo (MVP!)
3. Add User Story 2 → Test admin operations → Deploy/Demo
4. Add User Story 3 → Test location updates → Deploy/Demo
5. Add User Story 4-6 → Test remaining flows → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (trip flow)
   - Developer B: User Story 2 (admin operations)
   - Developer C: User Story 3 (location updates)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All event handlers MUST be idempotent
- All JetStream consumers MUST explicitly ack()/nak()
- 5-second timeout for all admin request/reply operations
- 7-day retention for operational events, 30-day for financial events
