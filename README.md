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

## Documentation

See `EXECUTION_PLAN.md` for detailed setup instructions.
