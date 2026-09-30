# Backend Monorepo Setup — 911 Ain Rider

## Current State

- **Directory**: `backend/` (empty)
- **Available Tooling**:
  - pnpm 10.15.1
  - Bun 1.2.21
  - Node v22
  - NestJS CLI 11
  - Docker 28 + Compose v2

---

## Monorepo Structure

Root managed by **pnpm workspaces**. Bun services live inside the workspace but are executed and Dockerized with Bun. NestJS services use Node.

```
backend/
├── pnpm-workspace.yaml          # apps/* and packages/*
├── package.json                 # private root, shared dev deps & scripts
├── tsconfig.base.json           # strict TS base extended by all services
├── .env.example                 # all env vars with internal hostnames
├── docker-compose.yml           # dev infra only (postgres, pgbouncer, redis, nats, minio)
├── apps/
│   ├── elysia/
│   │   ├── api-gateway/
│   │   ├── websocket-server/
│   │   ├── location-service/
│   │   └── match-service/
│   └── nest/
│       ├── auth-service/
│       ├── trip-service/
│       ├── payment-service/
│       └── admin-service/
└── packages/
    ├── shared-types/            # @ain-rider/shared-types
    ├── nats-client/             # @ain-rider/nats-client
    └── redis-client/            # @ain-rider/redis-client
```

### Service Directory Contents

Each service directory contains:
- `src/`
- `package.json`
- `tsconfig.json`
- `Dockerfile`

NestJS services additionally have:
- `test/`

---

## Shared Packages (`packages/`)

### `@ain-rider/shared-types`
- **Purpose**: TypeScript interfaces shared across all services
- **Exports**: User, Driver, Trip, Location, Fare, NATS event payloads
- **Build**: Compiled to `dist/`, referenced as `workspace:*`

### `@ain-rider/nats-client`
- **Purpose**: Typed wrapper around the `nats` npm library
- **Exports**: 
  - `createNatsConnection()`
  - `createPublisher()`
  - `createConsumer()`
- **Features**: Hides JetStream boilerplate and enforces subject naming conventions

### `@ain-rider/redis-client`
- **Purpose**: Typed wrapper around `ioredis` Cluster client
- **Exports**: `createRedisCluster()` configured from env
- **Ensures**: All services use the Cluster client, never single-node

---

## Service Scaffolding & Dependencies

### Elysia/Bun Services (4 services)

Each is a plain `bun init` project with `src/index.ts` entry.

#### Common Dependencies
```json
{
  "elysia": "^1.4.28",
  "@elysiajs/cors": "^1.4.1",
  "@elysiajs/swagger": "^1.3.1",
  "ioredis": "^5.10.1",
  "nats": "^2.29.3",
  "prom-client": "^15.1.3",
  "@ain-rider/shared-types": "workspace:*",
  "@ain-rider/nats-client": "workspace:*",
  "@ain-rider/redis-client": "workspace:*"
}
```

#### Per-Service Additions

**api-gateway**:
- `@elysiajs/jwt@^1.4.1`
- `@elysiajs/bearer@^1.4.3`
- `elysia-rate-limit@^4.5.1`

**websocket-server**:
- No extras (Elysia has native WS)

**location-service**:
- `h3-js@^4.4.0`
- `pg@^8.20.0` (TimescaleDB writes via PgBouncer)

**match-service**:
- `h3-js@^4.4.0`

#### Standard Endpoints

All Elysia services expose:
- `GET /health` — liveness probe
- `GET /ready` — readiness probe
- `GET /metrics` — Prometheus scrape endpoint

---

### NestJS/Node Services (4 services)

Scaffolded with `nest new --package-manager pnpm --skip-git`.

#### Common Dependencies
```json
{
  "@nestjs/platform-fastify": "^11.1.17",
  "@nestjs/config": "^4.0.3",
  "@nestjs/microservices": "^11.1.17",
  "@nestjs/terminus": "^11.1.1",
  "ioredis": "^5.10.1",
  "nats": "^2.29.3",
  "prom-client": "^15.1.3",
  "@prisma/client": "^7.5.0",
  "@ain-rider/shared-types": "workspace:*",
  "@ain-rider/nats-client": "workspace:*",
  "@ain-rider/redis-client": "workspace:*"
}
```

**Dev Dependencies**:
- `prisma@^7.5.0` (schema + migrations CLI)

#### Per-Service Additions

**auth-service**:
- `@nestjs/jwt@^11.0.2`
- `@nestjs/passport@^11.0.5`
- `passport-jwt@^4.0.1`
- `bcrypt@^6.0.0`

**trip-service, payment-service, admin-service**:
- No extra DB deps beyond Prisma

#### Standard Endpoints

All NestJS services expose:
- `/health` and `/ready` via `@nestjs/terminus`

---

## Prisma Setup (per NestJS service)

### Key Principles
- **Service Isolation**: Each service owns its domain schema. No shared schema file.
- **Database Connection**: Points to `DATABASE_URL` (PgBouncer URL)
- **Provider**: `postgresql`

### Configuration

Each service has `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### PrismaService Class
- Extends `PrismaClient`
- Implements `OnModuleInit` (`$connect`) / `OnApplicationShutdown` (`$disconnect`)
- Injected as a singleton provider

### Dependencies
- **Runtime**: `@prisma/client@^7.5.0`
- **Dev**: `prisma@^7.5.0` (CLI only)

### Build Process
```bash
prisma generate && nest build
```
Ensures the generated client is always fresh.

### Migrations
- **Local Dev**: `prisma migrate dev`
- **CI/Kubernetes**: `prisma migrate deploy` in init-container

### Dockerfile Integration
The NestJS Dockerfile builder stage runs `prisma generate` before `nest build`.

---

## Dockerfile Strategy

### Build Context
- **Always**: `backend/` root
- **Dockerfile Location**: Inside service directory
- **docker-compose.yml Reference**:
  ```yaml
  build:
    context: .          # backend/ root
    dockerfile: apps/elysia/api-gateway/Dockerfile
  ```

This allows Dockerfiles to `COPY` shared packages.

---

### Elysia/Bun — Multi-Stage

```dockerfile
FROM oven/bun:1.2-alpine AS deps
# Copy workspace config, root package.json, all packages/*, service package.json
# RUN bun install --frozen-lockfile

FROM oven/bun:1.2-alpine AS runner
# Copy node_modules + packages/*/dist + service src/ + tsconfig.json
CMD ["bun", "run", "src/index.ts"]
```

---

### NestJS/Node — Multi-Stage

```dockerfile
FROM node:22-alpine AS builder
# Install pnpm, copy workspace files + shared packages + service
# RUN pnpm install --frozen-lockfile
# RUN pnpm build

FROM node:22-alpine AS runner
# Copy dist/ + node_modules
CMD ["node", "dist/main.js"]
```

---

## Docker Compose — Local Dev Infrastructure

### Purpose
`docker-compose.yml` spins up **infrastructure only**. Application services run locally:
- Elysia: `bun run dev`
- NestJS: `pnpm run start:dev`

### Network
All infra containers share an `ain-rider-net` bridge network. Env vars injected from `.env` file.

---

### Services

#### **postgres**
- **Image**: `timescale/timescaledb-ha:pg17-latest`
- **Features**: PostGIS + TimescaleDB
- **Access**: Internal only; PgBouncer is the sole entry point for services

#### **pgbouncer**
- **Image**: `bitnami/pgbouncer:latest`
- **Mode**: Transaction pooling
- **Host Port**: `5432`
- **Purpose**: All services (local and K8s) connect here

#### **redis-1 … redis-6**
- **Image**: `redis:7.4-alpine`
- **Config**: `--cluster-enabled yes`
- **Announce Config**: 
  - `--cluster-announce-ip 127.0.0.1`
  - `--cluster-announce-port <unique-host-port>`
- **Host Ports**: `6379–6384` (unique per node)
- **Purpose**: Locally-running services can reach the cluster

#### **redis-cluster-init**
- **Type**: One-shot init container
- **Command**: `redis-cli --cluster create` across all 6 nodes
- **Restart**: `no`

#### **nats**
- **Image**: `nats:2.10-alpine`
- **Args**: `-js` (JetStream enabled)
- **Host Ports**: 
  - `4222` (clients)
  - `8222` (monitoring UI)

#### **minio**
- **Image**: `minio/minio:RELEASE.2025-02-28T09-55-16Z`
- **Host Ports**: 
  - `9000` (API)
  - `9001` (console)
- **Init**: `mc` init container creates the `ain-rider` bucket on first start

---

## Environment Variables Pattern

Two `.env` variants are provided:

### `.env.example` (Local Dev)
Services run on host, pointing to localhost ports exposed by Docker:

```env
DATABASE_URL=postgresql://ainrider:password@localhost:5432/ainrider?schema=public
REDIS_NODES=localhost:6379,localhost:6380,localhost:6381,localhost:6382,localhost:6383,localhost:6384
NATS_URL=nats://localhost:4222
MINIO_ENDPOINT=localhost:9000
JWT_SECRET=<from-vault>
```

### `.env.k8s.example` (K8s / Prod)
Uses internal service-mesh hostnames:

```env
DATABASE_URL=postgresql://ainrider:password@pgbouncer:5432/ainrider?schema=public
REDIS_NODES=redis-1:6379,redis-2:6379,redis-3:6379,redis-4:6379,redis-5:6379,redis-6:6379
NATS_URL=nats://nats:4222
MINIO_ENDPOINT=minio:9000
JWT_SECRET=<from-vault>
```

### Notes
- Prisma uses `DATABASE_URL` directly
- No separate `POSTGRES_HOST`/`PORT` vars needed

---

## Architecture Highlights

### Service Communication
- **NATS JetStream**: Event-driven messaging between services
- **Redis Cluster**: Distributed caching and session storage
- **PgBouncer**: Connection pooling for PostgreSQL

### Technology Stack
- **Elysia Services**: High-performance Bun runtime for real-time operations
- **NestJS Services**: Structured Node.js services for business logic
- **TimescaleDB**: Time-series data for location tracking
- **MinIO**: S3-compatible object storage

### Development Workflow
1. Start infrastructure: `docker-compose up -d`
2. Run services locally: `bun run dev` or `pnpm run start:dev`
3. Services connect to localhost-exposed infrastructure ports
4. Hot reload enabled for rapid development

### Production Deployment
1. Build Docker images with multi-stage builds
2. Deploy to Kubernetes with service mesh
3. Services connect via internal DNS names
4. Init containers handle database migrations

---

## Next Steps

1. **Initialize Workspace**: Create `pnpm-workspace.yaml` and root `package.json`
2. **Scaffold Shared Packages**: Set up `@ain-rider/shared-types`, `nats-client`, `redis-client`
3. **Create Elysia Services**: Initialize 4 Bun-based services
4. **Create NestJS Services**: Initialize 4 Node-based services with Prisma
5. **Configure Docker Compose**: Set up local development infrastructure
6. **Create Dockerfiles**: Multi-stage builds for each service
7. **Environment Configuration**: Set up `.env.example` and `.env.k8s.example`
8. **Base TypeScript Config**: Create `tsconfig.base.json` for strict mode
