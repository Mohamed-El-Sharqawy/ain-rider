# Phase 5: Docker & Local Development

**Prerequisites**: Phases 1–4 complete, Docker Desktop 28+ running  
**Goal**: Run the full infrastructure stack locally via Docker Compose so you can develop and test all services without needing Kubernetes.

---

## What This Phase Covers

- `docker-compose.yml` — PostgreSQL/TimescaleDB, PgBouncer, Redis Cluster (6-node), NATS JetStream, MinIO
- `backend/scripts/init-db.sql` — TimescaleDB hypertable + indexes for `driver_locations`
- Dockerfiles for all 8 services (4 Elysia/Bun + 4 NestJS)
- Build scripts in `backend/package.json`

---

## When to Use This vs k3d (Phase 6)

| Scenario | Use |
|---|---|
| Developing a single service, need infra running fast | Docker Compose (this phase) |
| Testing the full system end-to-end with routing, Ingress, scaling | k3d (Phase 6) |
| CI pipeline building images | Docker Compose + Dockerfiles |
| Preparing for production deployment | k3d → production Helm (Phase 6) |

Docker Compose starts in ~20 seconds and uses less RAM. Use it daily during development. Use k3d when you need to test Kubernetes-specific behaviour.

---

## Step 1 — Docker Compose

Create `backend/docker-compose.yml`:

```yaml
version: '3.8'

networks:
  ain-rider-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data_1:
  redis_data_2:
  redis_data_3:
  redis_data_4:
  redis_data_5:
  redis_data_6:
  nats_data:
  minio_data:

services:

  # ── PostgreSQL + TimescaleDB ──────────────────────────────────────────────
  postgres:
    image: timescale/timescaledb-ha:pg17-latest
    container_name: ain-rider-postgres
    environment:
      POSTGRES_USER: ainrider
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ainrider
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - ain-rider-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ainrider"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── PgBouncer ─────────────────────────────────────────────────────────────
  pgbouncer:
    image: bitnami/pgbouncer:latest
    container_name: ain-rider-pgbouncer
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: 5432
      POSTGRESQL_USERNAME: ainrider
      POSTGRESQL_PASSWORD: password
      POSTGRESQL_DATABASE: ainrider
      PGBOUNCER_DATABASE: ainrider
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 1000
      PGBOUNCER_DEFAULT_POOL_SIZE: 25
    ports:
      - "5432:6432"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - ain-rider-net

  # ── Redis Cluster (6 nodes: 3 masters + 3 replicas) ──────────────────────
  redis-1:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-1
    command: >
      redis-server
      --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
      --port 6379
      --cluster-announce-ip 127.0.0.1
      --cluster-announce-port 6379 --cluster-announce-bus-port 16379
    ports: ["6379:6379", "16379:16379"]
    volumes: [redis_data_1:/data]
    networks: [ain-rider-net]

  redis-2:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-2
    command: >
      redis-server
      --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
      --port 6379
      --cluster-announce-ip 127.0.0.1
      --cluster-announce-port 6380 --cluster-announce-bus-port 16380
    ports: ["6380:6379", "16380:16379"]
    volumes: [redis_data_2:/data]
    networks: [ain-rider-net]

  redis-3:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-3
    command: >
      redis-server
      --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
      --port 6379
      --cluster-announce-ip 127.0.0.1
      --cluster-announce-port 6381 --cluster-announce-bus-port 16381
    ports: ["6381:6379", "16381:16379"]
    volumes: [redis_data_3:/data]
    networks: [ain-rider-net]

  redis-4:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-4
    command: >
      redis-server
      --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
      --port 6379
      --cluster-announce-ip 127.0.0.1
      --cluster-announce-port 6382 --cluster-announce-bus-port 16382
    ports: ["6382:6379", "16382:16379"]
    volumes: [redis_data_4:/data]
    networks: [ain-rider-net]

  redis-5:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-5
    command: >
      redis-server
      --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
      --port 6379
      --cluster-announce-ip 127.0.0.1
      --cluster-announce-port 6383 --cluster-announce-bus-port 16383
    ports: ["6383:6379", "16383:16379"]
    volumes: [redis_data_5:/data]
    networks: [ain-rider-net]

  redis-6:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-6
    command: >
      redis-server
      --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
      --port 6379
      --cluster-announce-ip 127.0.0.1
      --cluster-announce-port 6384 --cluster-announce-bus-port 16384
    ports: ["6384:6379", "16384:16379"]
    volumes: [redis_data_6:/data]
    networks: [ain-rider-net]

  redis-cluster-init:
    image: redis:7.4-alpine
    container_name: ain-rider-redis-cluster-init
    command: >
      sh -c "sleep 10 &&
      redis-cli --cluster create
      127.0.0.1:6379 127.0.0.1:6380 127.0.0.1:6381
      127.0.0.1:6382 127.0.0.1:6383 127.0.0.1:6384
      --cluster-replicas 1 --cluster-yes"
    depends_on: [redis-1, redis-2, redis-3, redis-4, redis-5, redis-6]
    networks: [ain-rider-net]
    restart: "no"

  # ── NATS JetStream ────────────────────────────────────────────────────────
  nats:
    image: nats:2.10-alpine
    container_name: ain-rider-nats
    command: ["-js", "-m", "8222"]
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes: [nats_data:/data]
    networks: [ain-rider-net]
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8222/healthz"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── MinIO S3 ──────────────────────────────────────────────────────────────
  minio:
    image: minio/minio:RELEASE.2025-02-28T09-55-16Z
    container_name: ain-rider-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes: [minio_data:/data]
    networks: [ain-rider-net]
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio-init:
    image: minio/mc:latest
    container_name: ain-rider-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      sh -c "
      mc alias set myminio http://minio:9000 minioadmin minioadmin &&
      mc mb myminio/ain-rider --ignore-existing &&
      mc anonymous set download myminio/ain-rider"
    networks: [ain-rider-net]
    restart: "no"
```

---

## Step 2 — Database Initialization Script

Create `backend/scripts/init-db.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS driver_locations (
  id          BIGSERIAL,
  driver_id   VARCHAR(255)      NOT NULL,
  latitude    DOUBLE PRECISION  NOT NULL,
  longitude   DOUBLE PRECISION  NOT NULL,
  h3_index    VARCHAR(20)       NOT NULL,
  heading     DOUBLE PRECISION,
  speed       DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, recorded_at)
);

SELECT create_hypertable('driver_locations', 'recorded_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id
  ON driver_locations (driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_locations_h3
  ON driver_locations (h3_index, recorded_at DESC);

SELECT add_retention_policy('driver_locations', INTERVAL '30 days', if_not_exists => TRUE);
```

---

## Step 3 — Dockerfiles

### Elysia/Bun Services

All 4 Elysia services share the same Dockerfile pattern. They are already created at:

```
backend/apps/elysia/api-gateway/Dockerfile
backend/apps/elysia/websocket-server/Dockerfile
backend/apps/elysia/location-service/Dockerfile
backend/apps/elysia/match-service/Dockerfile
```

The pattern (monorepo-aware, builds shared packages first):

```dockerfile
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# Copy workspace root so pnpm workspace resolution works
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/elysia/<service-name> ./apps/elysia/<service-name>

# Build shared packages then the service
RUN cd packages/shared-types  && bun install && bun run build
RUN cd packages/nats-client   && bun install && bun run build
RUN cd packages/redis-client  && bun install && bun run build
RUN cd apps/elysia/<service-name> && bun install --frozen-lockfile

FROM oven/bun:1.1-alpine
WORKDIR /app

RUN addgroup -S ainrider && adduser -S ainrider -G ainrider

COPY --from=builder /app/packages/shared-types/dist  ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/nats-client/dist   ./packages/nats-client/dist
COPY --from=builder /app/packages/nats-client/package.json ./packages/nats-client/
COPY --from=builder /app/packages/redis-client/dist  ./packages/redis-client/dist
COPY --from=builder /app/packages/redis-client/package.json ./packages/redis-client/
COPY --from=builder /app/apps/elysia/<service-name>/node_modules \
                        ./apps/elysia/<service-name>/node_modules
COPY apps/elysia/<service-name>/src        ./apps/elysia/<service-name>/src
COPY apps/elysia/<service-name>/tsconfig.json ./apps/elysia/<service-name>/

WORKDIR /app/apps/elysia/<service-name>
USER ainrider
EXPOSE <port>
CMD ["bun", "run", "src/index.ts"]
```

> **Note:** The current Dockerfiles in the repo are simplified (no monorepo workspace copy). They work when built from inside each service directory. Once the NestJS shared packages are built to `dist/`, update the Dockerfiles to the full pattern above so the shared packages resolve correctly inside the image.

### NestJS Services

Create `backend/apps/nest/auth-service/Dockerfile` (same pattern for all 4):

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.15.1

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/nest/auth-service ./apps/nest/auth-service

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @ain-rider/shared-types build
RUN pnpm --filter @ain-rider/nats-client  build
RUN pnpm --filter @ain-rider/redis-client build

WORKDIR /app/apps/nest/auth-service
RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm@10.15.1

COPY --from=builder /app/apps/nest/auth-service/dist    ./dist
COPY --from=builder /app/apps/nest/auth-service/node_modules ./node_modules
COPY --from=builder /app/apps/nest/auth-service/prisma  ./prisma
COPY apps/nest/auth-service/package.json ./

EXPOSE 4000
CMD ["node", "dist/main.js"]
```

---

## Step 4 — Build Scripts

Add to `backend/package.json` scripts:

```json
{
  "scripts": {
    "docker:infra:up":   "docker-compose up -d",
    "docker:infra:down": "docker-compose down",
    "docker:infra:clean": "docker-compose down -v",
    "docker:build:elysia": "docker build -f apps/elysia/api-gateway/Dockerfile    -t ainrider/api-gateway:local    . && docker build -f apps/elysia/websocket-server/Dockerfile -t ainrider/websocket-server:local . && docker build -f apps/elysia/location-service/Dockerfile  -t ainrider/location-service:local . && docker build -f apps/elysia/match-service/Dockerfile    -t ainrider/match-service:local    .",
    "docker:build:nest":   "docker build -f apps/nest/auth-service/Dockerfile     -t ainrider/auth-service:local    . && docker build -f apps/nest/trip-service/Dockerfile      -t ainrider/trip-service:local     . && docker build -f apps/nest/payment-service/Dockerfile   -t ainrider/payment-service:local  . && docker build -f apps/nest/admin-service/Dockerfile    -t ainrider/admin-service:local    .",
    "docker:build:all":    "pnpm docker:build:elysia && pnpm docker:build:nest"
  }
}
```

---

## Step 5 — Start Infrastructure

```bash
cd backend

# Start all infra containers
docker-compose up -d

# Verify status
docker-compose ps

# Check Redis cluster formed (wait ~15s after start)
docker exec -it ain-rider-redis-1 redis-cli cluster info | grep cluster_state
# Expected: cluster_state:ok

# Check PostgreSQL
docker exec -it ain-rider-postgres psql -U ainrider -d ainrider -c "\dt"

# Check NATS
curl http://localhost:8222/varz | grep server_name

# Check MinIO
open http://localhost:9001   # admin: minioadmin / minioadmin
```

---

## Step 6 — Run Services Locally Against Compose Infra

Set environment variables for each service pointing to the Docker Compose ports:

```bash
# In backend/apps/elysia/api-gateway — create .env
NATS_URL=nats://localhost:4222
REDIS_NODES=localhost:6379,localhost:6380,localhost:6381
DATABASE_URL=postgresql://ainrider:password@localhost:5432/ainrider
JWT_SECRET=local_dev_secret

# Start the service
bun run src/index.ts

# In another terminal — test
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

---

## Step 7 — Run Database Migrations (after Phase 4 NestJS)

```bash
cd apps/nest/auth-service   && pnpm prisma:migrate
cd ../trip-service          && pnpm prisma:migrate
cd ../payment-service       && pnpm prisma:migrate
cd ../admin-service         && pnpm prisma:migrate
```

---

## Daily Commands

```bash
# Start infra (morning)
cd backend && docker-compose up -d

# Stop infra (done for the day)
docker-compose down

# Full reset (wipe all data)
docker-compose down -v && docker-compose up -d

# Stream logs
docker-compose logs -f nats
docker-compose logs -f postgres

# Restart one container
docker-compose restart pgbouncer
```

---

## Troubleshooting

**Redis Cluster not forming (`cluster_state:fail`)**

```bash
docker-compose down -v && docker-compose up -d
# Wait 15 seconds, then:
docker exec -it ain-rider-redis-1 redis-cli cluster info
```

**PgBouncer connection refused**

```bash
# Check Postgres is healthy first
docker-compose logs postgres | tail -20
docker exec -it ain-rider-postgres pg_isready -U ainrider
```

**Port already in use**

```bash
# Windows PowerShell — find what's using port 5432
netstat -ano | findstr :5432
# Kill the PID shown, or change the port mapping in docker-compose.yml
```

---

## Next Steps

Phase 5 complete. Proceed to **Phase 6** (`PHASE_6_KUBERNETES.md`) to run the same stack inside a local k3d Kubernetes cluster and prepare production manifests.
