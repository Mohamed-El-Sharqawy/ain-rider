# NATS Subject Contracts

**Feature**: 002-nats-interservice-refactor  
**Date**: 2026-03-24

## Overview

This document defines all NATS subjects used for inter-service communication in the ain-rider backend.

---

## JetStream Subjects (Async Events)

### Trip Domain

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.trip_requested` | trip-service | match-service | New trip request created |
| `ain_rider.trip_matched` | match-service | trip-service, websocket-server | Driver matched to trip |
| `ain_rider.trip_started` | trip-service | websocket-server | Trip in progress |
| `ain_rider.trip_completed` | trip-service | payment-service, websocket-server | Trip finished |
| `ain_rider.trip_cancelled` | trip-service | websocket-server | Trip cancelled |
| `ain_rider.trip_no_match` | match-service | trip-service | No driver found |
| `ain_rider.sos_created` | trip-service | websocket-server, admin-service | Emergency triggered |
| `ain_rider.sos_resolved` | trip-service | websocket-server | Emergency resolved |

### User Domain

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.user_created` | auth-service | admin-service, trip-service | New user registered |
| `ain_rider.user_updated` | auth-service | admin-service | User profile updated |
| `ain_rider.user_status_changed` | auth-service | all services | User status changed |
| `ain_rider.user_deleted` | auth-service | all services | User account deleted |

### Location Domain

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.location_update` | location-service | websocket-server | Driver GPS update |

### Payment Domain

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.payment_processed` | payment-service | websocket-server | Payment completed |
| `ain_rider.wallet_updated` | payment-service | websocket-server | Wallet balance changed |
| `ain_rider.withdrawal_requested` | payment-service | admin-service | Withdrawal initiated |
| `ain_rider.withdrawal_processed` | payment-service | websocket-server | Withdrawal completed |

### Notification Domain

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.notification_sent` | admin-service | websocket-server | Notification dispatched |

### Complaint Domain

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.complaint_created` | admin-service | - | New complaint filed |
| `ain_rider.complaint_updated` | admin-service | - | Complaint status changed |

### Dead Letter Queue

| Subject | Publisher | Consumers | Description |
|---------|-----------|-----------|-------------|
| `ain_rider.dlq.*` | all services | admin-service | Failed messages |

---

## NATS Core Subjects (Sync Request/Reply)

### User Operations

| Subject | Responder | Requester | Timeout | Description |
|---------|-----------|-----------|---------|-------------|
| `user.suspend.request` | auth-service | admin-service | 5s | Suspend user account |
| `user.activate.request` | auth-service | admin-service | 5s | Reactivate user |
| `user.update.request` | auth-service | admin-service | 5s | Update user profile |

### Trip Operations

| Subject | Responder | Requester | Timeout | Description |
|---------|-----------|-----------|---------|-------------|
| `trip.create.request` | trip-service | admin-service | 5s | Create trip manually |
| `trip.cancel.request` | trip-service | admin-service | 5s | Cancel active trip |
| `trip.assign_driver.request` | trip-service | admin-service | 5s | Manual driver assignment |
| `trip.update_status.request` | trip-service | admin-service | 5s | Update trip status |

### Payment Operations

| Subject | Responder | Requester | Timeout | Description |
|---------|-----------|-----------|---------|-------------|
| `payment.refund.request` | payment-service | admin-service | 5s | Process refund |
| `payment.adjust.request` | payment-service | admin-service | 5s | Adjust payment amount |

---

## Subject Naming Conventions

### JetStream Events

```
ain_rider.{domain}_{action}
```

- **domain**: trip, user, location, payment, wallet, withdrawal, notification, complaint, sos
- **action**: created, updated, deleted, requested, matched, started, completed, cancelled, processed, sent, resolved

### Request/Reply

```
{domain}.{action}.request
```

- **domain**: user, trip, payment
- **action**: suspend, activate, update, create, cancel, assign_driver, update_status, refund, adjust

---

## Message Headers

All NATS messages MUST include these headers:

| Header | Format | Description |
|--------|--------|-------------|
| `traceparent` | W3C trace-context | Distributed tracing ID |
| `Nats-Msg-Id` | UUID | Deduplication ID |
| `Content-Type` | `application/json` | Payload format |

---

## Error Codes

Request/reply responses use these error codes:

| Code | HTTP Equivalent | Description |
|------|-----------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource state conflict |
| `FORBIDDEN` | 403 | Operation not allowed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `TIMEOUT` | 503 | Downstream service timeout |
