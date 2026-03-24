# NATS Architecture Diagram

## Event Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NATS JetStream Cluster                                  │
│                           (ain_rider stream + DLQ)                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         │                               │                               │
         ▼                               ▼                               ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│  Event Subjects │             │ Request Subjects │             │   DLQ Subjects   │
│                 │             │                 │             │                 │
│ ain_rider.*     │             │ *.request       │             │ ain_rider.dlq.* │
│ (pub/sub)       │             │ (request/reply) │             │ (error handling)│
└─────────────────┘             └─────────────────┘             └─────────────────┘
```

## Service Communication Patterns

### Event Publishing (JetStream)

```
┌──────────────┐     publish      ┌──────────────┐     consume      ┌──────────────┐
│              │ ───────────────▶ │              │ ───────────────▶ │              │
│  Publisher   │   ain_rider.*    │    NATS      │                  │  Consumer    │
│   Service    │                  │  JetStream   │                  │   Service    │
│              │                  │              │                  │              │
└──────────────┘                  └──────────────┘                  └──────────────┘
      │                                                                     │
      │                                                                     │
      ▼                                                                     ▼
  Event Types:                                                        Event Handlers:
  - user_created                                                      - Update local DB
  - user_updated                                                      - Send WebSocket
  - location_update                                                   - Trigger actions
  - trip_requested
  - trip_matched
  - trip_completed
  - payment_processed
  - sos_created
```

### Request-Reply (Synchronous)

```
┌──────────────┐     request       ┌──────────────┐     reply        ┌──────────────┐
│              │ ───────────────▶ │              │ ───────────────▶ │              │
│   Requester  │   *.request       │    NATS      │                  │  Responder   │
│   Service    │   (timeout: 5s)   │   Core       │   (correlate)    │   Service    │
│              │                   │              │                  │              │
└──────────────┘                   └──────────────┘                  └──────────────┘
      │                                                                     │
      │                                                                     │
      ▼                                                                     ▼
  Request Types:                                                      Response Handlers:
  - trip.cancel.request                                               - Return result
  - trip.assign_driver.request                                        - Return error
  - payment.refund.request                                            - Validate request
  - user.suspend.request
  - user.activate.request
```

## Service Topology

```
                              ┌─────────────────────────────────┐
                              │         admin-service           │
                              │        (NestJS :4003)           │
                              │                                 │
                              │  Publishers:                    │
                              │  - (none - consumes events)     │
                              │                                 │
                              │  Consumers:                     │
                              │  - user_created                 │
                              │  - user_updated                 │
                              │  - user_status_changed          │
                              │                                 │
                              │  Requesters:                    │
                              │  - trip.cancel.request          │
                              │  - trip.assign_driver.request   │
                              │  - payment.refund.request       │
                              │  - user.suspend.request         │
                              │  - user.activate.request        │
                              └────────────┬────────────────────┘
                                           │
                                           │ NATS
                                           │
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │                                  │                                  │
        ▼                                  ▼                                  ▼
┌───────────────────┐           ┌───────────────────┐           ┌───────────────────┐
│   auth-service    │           │   trip-service    │           │  payment-service  │
│  (NestJS :4000)   │           │  (NestJS :4001)   │           │  (NestJS :4002)   │
│                   │           │                   │           │                   │
│  Publishers:      │           │  Publishers:      │           │  Publishers:      │
│  - user_created   │           │  - trip_requested │           │  - payment_       │
│  - user_updated   │           │  - trip_started   │           │    processed      │
│  - user_status_   │           │  - trip_completed │           │                   │
│    changed        │           │  - trip_cancelled │           │  Consumers:       │
│                   │           │  - sos_created    │           │  - trip_completed │
│  Responders:      │           │  - sos_resolved   │           │  - trip_cancelled │
│  - user.suspend.  │           │                   │           │                   │
│    request        │           │  Consumers:       │           │  Responders:      │
│  - user.activate. │           │  - trip_matched   │           │  - payment.refund │
│    request        │           │                   │           │    .request       │
└───────────────────┘           │  Responders:      │           └───────────────────┘
                                │  - trip.cancel.   │
                                │    request        │
                                │  - trip.assign_   │
                                │    driver.request │
                                └───────────────────┘


┌───────────────────────────────────────────────────────────────────────────────────┐
│                           Elysia/Bun Services                                      │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐             │
│  │ location-service  │  │  match-service    │  │ websocket-server  │             │
│  │  (Bun :3002)      │  │  (Bun :3003)      │  │  (Bun :3001)      │             │
│  │                   │  │                   │  │                   │             │
│  │ Publishers:       │  │ Consumers:        │  │ Consumers:        │             │
│  │ - location_update │  │ - trip_requested  │  │ - location_update │             │
│  │                   │  │                   │  │ - trip_matched    │             │
│  │                   │  │ Publishers:       │  │ - trip_started    │             │
│  │                   │  │ - trip_matched    │  │ - trip_completed  │             │
│  │                   │  │ - trip_no_match   │  │ - trip_cancelled  │             │
│  │                   │  │                   │  │ - payment_        │             │
│  │                   │  │                   │  │   processed       │             │
│  │                   │  │                   │  │ - sos_created     │             │
│  │                   │  │                   │  │ - sos_resolved    │             │
│  │                   │  │                   │  │ - notification_   │             │
│  │                   │  │                   │  │   sent            │             │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘             │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## Event Envelope Structure

```json
{
  "eventId": "uuid-v4",
  "eventType": "trip_completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "trip-service",
  "version": 1,
  "traceId": "trace-uuid",
  "data": {
    // Event-specific payload
  }
}
```

## Error Handling Flow

```
┌──────────────┐     failure      ┌──────────────┐     retry       ┌──────────────┐
│              │ ───────────────▶ │              │ ───────────────▶ │              │
│   Consumer   │   nak()          │    NATS      │   redelivery    │   Consumer   │
│              │                  │  JetStream   │   (max: 3)      │   (retry)    │
└──────────────┘                  └──────────────┘                  └──────────────┘
      │                                                                     │
      │ max retries exceeded                                                │
      ▼                                                                     │
┌──────────────┐     publish      ┌──────────────┐
│              │ ───────────────▶ │              │
│   Consumer   │   ack()          │    DLQ       │
│              │                  │  Stream     │
│              │                  │              │
└──────────────┘                  └──────────────┘
                                        │
                                        ▼
                                  ┌──────────────┐
                                  │ DLQ Monitor  │
                                  │ (alerting)   │
                                  └──────────────┘
```

## Metrics & Monitoring

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Prometheus Metrics                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  nats_connections_active{service}         - Active connections        │
│  nats_messages_published_total{service,subject} - Published count     │
│  nats_messages_received_total{service,subject} - Received count      │
│  nats_message_latency_seconds{service,subject} - Processing latency  │
│  nats_requests_total{service,request_type,status} - Request count     │
│  nats_jetstream_pending_messages{consumer} - Pending messages        │
│  nats_dlq_messages_total{service,original_subject} - DLQ count       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```
