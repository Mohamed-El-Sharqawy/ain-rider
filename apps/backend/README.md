# 911 Ain Rider Backend

Production-ready microservices monorepo for the 911 Ain Rider platform.

## Architecture

- **4 Elysia/Bun services** - High-throughput real-time operations
- **4 NestJS/Node services** - Business logic and data management
- **3 Shared packages** - Type safety and client abstractions

## Quick Start

### Prerequisites

- pnpm 10.15.1+
- Bun 1.2.21+
- Node.js v22+
- Docker 28+ with Compose v2

### Local Development

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start infrastructure:
   ```bash
   pnpm docker:up
   ```

3. Copy environment file:
   ```bash
   cp .env.example .env
   ```

4. Run all services:
   ```bash
   pnpm dev
   ```

## Services

### Elysia/Bun Services
- **api-gateway** (`:3000`) - JWT auth, rate limiting, routing
- **websocket-server** (`:3001`) - Real-time WebSocket connections
- **location-service** (`:3002`) - Geospatial tracking with H3
- **match-service** (`:3003`) - Driver-rider matching

### NestJS/Node Services
- **auth-service** (`:4000`) - Authentication and authorization
- **trip-service** (`:4001`) - Trip lifecycle management
- **payment-service** (`:4002`) - Payment processing
- **admin-service** (`:4003`) - Admin dashboard and analytics

## Infrastructure

- **PostgreSQL + PgBouncer** - Transactional data with connection pooling
- **TimescaleDB** - Time-series location data
- **Redis Cluster** - 6-node distributed cache
- **NATS JetStream** - Event streaming and pub/sub
- **MinIO** - S3-compatible object storage

## NATS JetStream

NATS JetStream is the central event bus for inter-service communication.

### Cluster Configuration

3-node cluster for fault tolerance with quorum-based replication:

| Node | Client Port | Cluster Port | Monitor Port |
|------|-------------|--------------|--------------|
| nats-1 | 4222 | 6222 | 8222 |
| nats-2 | 4223 | 6223 | 8223 |
| nats-3 | 4224 | 6224 | 8224 |

**Connection**: Services connect to `nats://nats-1:4222` (or any node). The cluster routes internally.

### Event Subjects

| Subject | Publisher | Consumers |
|---------|-----------|-----------|
| `ain_rider.user_created` | auth-service | admin-service |
| `ain_rider.user_updated` | auth-service | admin-service |
| `ain_rider.user_status_changed` | auth-service | admin-service |
| `ain_rider.location_update` | location-service | websocket-server |
| `ain_rider.trip_requested` | trip-service | match-service |
| `ain_rider.trip_matched` | match-service | trip-service, websocket-server |
| `ain_rider.trip_started` | trip-service | websocket-server, payment-service |
| `ain_rider.trip_completed` | trip-service | websocket-server, payment-service |
| `ain_rider.trip_cancelled` | trip-service | websocket-server, payment-service |
| `ain_rider.payment_processed` | payment-service | websocket-server |
| `ain_rider.sos_created` | trip-service | websocket-server |
| `ain_rider.sos_resolved` | trip-service | websocket-server |
| `ain_rider.notification_sent` | notification-service | websocket-server |

### Request-Reply Subjects

| Subject | Requester | Responder |
|---------|-----------|-----------|
| `trip.cancel.request` | admin-service | trip-service |
| `trip.assign_driver.request` | admin-service | trip-service |
| `payment.refund.request` | admin-service | payment-service |
| `user.suspend.request` | admin-service | auth-service |
| `user.activate.request` | admin-service | auth-service |

### Configuration

Set `NATS_URL` environment variable (default: `nats://localhost:4222`):

```env
NATS_URL=nats://localhost:4222
```

**Stream Replicas:**
- Default: `NATS_REPLICAS=3` - fault tolerance with quorum-based replication (recommended for both dev and prod)
- Single-node dev: `NATS_REPLICAS=1` - only if running a single NATS node without clustering

Set via environment variable before running setup scripts:
```bash
NATS_REPLICAS=3 pnpm setup:nats
```

### Monitoring

- **JetStream Manager**: http://localhost:8222 (NATS monitoring)
- **Prometheus Metrics**: Each service exposes NATS metrics at `/metrics`

### DLQ (Dead Letter Queue)

Failed messages are sent to `ain_rider.dlq.<original_subject>` after max retries.
Monitor DLQ messages via the `DLQAlertingService` in `@ain-rider/nats-client`.

## Documentation

See `EXECUTION_PLAN.md` for detailed setup instructions.
