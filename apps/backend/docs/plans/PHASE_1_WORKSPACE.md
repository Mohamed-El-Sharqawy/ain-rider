# Phase 1: Workspace & Foundation Setup

**Estimated Time**: 30 minutes  
**Prerequisites**: pnpm 10.15.1+, Node.js v22+, Bun 1.2.21+

---

## Objectives

- Initialize pnpm workspace
- Create root package.json with shared dev dependencies
- Set up base TypeScript configuration
- Create directory structure
- Configure environment templates

---

## Step 1: Initialize Root Package.json

Create `backend/package.json`:

```json
{
  "name": "ain-rider-backend",
  "version": "1.0.0",
  "private": true,
  "description": "911 Ain Rider Backend Monorepo",
  "scripts": {
    "dev": "pnpm --parallel --filter './apps/**' dev",
    "build": "pnpm --recursive --filter './packages/**' build && pnpm --recursive --filter './apps/**' build",
    "test": "pnpm --recursive test",
    "lint": "pnpm --recursive lint",
    "clean": "pnpm --recursive clean && rm -rf node_modules",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "prisma:generate": "pnpm --recursive --filter './apps/nest/**' exec prisma generate",
    "prisma:migrate": "pnpm --recursive --filter './apps/nest/**' exec prisma migrate dev"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "typescript": "^5.7.3",
    "prettier": "^3.4.2",
    "eslint": "^9.18.0",
    "rimraf": "^6.0.1"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

---

## Step 2: Configure pnpm Workspace

Create `backend/pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/**'
  - 'packages/**'
```

---

## Step 3: Create Base TypeScript Configuration

Create `backend/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "removeComments": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@ain-rider/shared-types": ["./packages/shared-types/src"],
      "@ain-rider/nats-client": ["./packages/nats-client/src"],
      "@ain-rider/redis-client": ["./packages/redis-client/src"]
    }
  },
  "exclude": ["node_modules", "dist", "build"]
}
```

---

## Step 4: Create Directory Structure

Run the following commands from `backend/`:

```bash
# Create app directories
mkdir -p apps/elysia/api-gateway
mkdir -p apps/elysia/websocket-server
mkdir -p apps/elysia/location-service
mkdir -p apps/elysia/match-service

mkdir -p apps/nest/auth-service
mkdir -p apps/nest/trip-service
mkdir -p apps/nest/payment-service
mkdir -p apps/nest/admin-service

# Create package directories
mkdir -p packages/shared-types/src
mkdir -p packages/nats-client/src
mkdir -p packages/redis-client/src
```

---

## Step 5: Create Environment Templates

### Local Development Environment

Create `backend/.env.example`:

```env
# Database (via PgBouncer)
DATABASE_URL=postgresql://ainrider:password@localhost:5432/ainrider?schema=public

# Redis Cluster (6 nodes)
REDIS_NODES=localhost:6379,localhost:6380,localhost:6381,localhost:6382,localhost:6383,localhost:6384

# NATS JetStream
NATS_URL=nats://localhost:4222

# MinIO S3
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=ain-rider

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# API Gateway
API_GATEWAY_PORT=3000

# WebSocket Server
WEBSOCKET_PORT=3001

# Location Service
LOCATION_SERVICE_PORT=3002

# Match Service
MATCH_SERVICE_PORT=3003

# Auth Service
AUTH_SERVICE_PORT=4000

# Trip Service
TRIP_SERVICE_PORT=4001

# Payment Service
PAYMENT_SERVICE_PORT=4002

# Admin Service
ADMIN_SERVICE_PORT=4003

# Node Environment
NODE_ENV=development
```

### Kubernetes/Production Environment

Create `backend/.env.k8s.example`:

```env
# Database (via PgBouncer - internal service)
DATABASE_URL=postgresql://ainrider:${POSTGRES_PASSWORD}@pgbouncer:5432/ainrider?schema=public

# Redis Cluster (internal StatefulSet)
REDIS_NODES=redis-0.redis-headless:6379,redis-1.redis-headless:6379,redis-2.redis-headless:6379,redis-3.redis-headless:6379,redis-4.redis-headless:6379,redis-5.redis-headless:6379

# NATS JetStream (internal service)
NATS_URL=nats://nats:4222

# MinIO S3 (internal service)
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_BUCKET=ain-rider

# JWT (from Kubernetes Secret)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Service Ports (internal)
API_GATEWAY_PORT=3000
WEBSOCKET_PORT=3001
LOCATION_SERVICE_PORT=3002
MATCH_SERVICE_PORT=3003
AUTH_SERVICE_PORT=4000
TRIP_SERVICE_PORT=4001
PAYMENT_SERVICE_PORT=4002
ADMIN_SERVICE_PORT=4003

# Node Environment
NODE_ENV=production
```

---

## Step 6: Create .gitignore

Create `backend/.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Docker
.docker/

# Prisma
prisma/migrations/
*.db
*.db-journal

# Test coverage
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
```

---

## Step 7: Create README

Create `backend/README.md`:

```markdown
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
```

---

## Step 8: Initialize Git Repository

```bash
cd backend
git init
git add .
git commit -m "feat: initialize backend monorepo workspace"
```

---

## Verification Steps

Run these commands to verify Phase 1 completion:

```bash
# Verify pnpm workspace
pnpm list --depth 0

# Verify directory structure
tree -L 3 -d

# Verify TypeScript config
cat tsconfig.base.json

# Verify environment templates exist
ls -la .env.example .env.k8s.example
```

---

## Expected Output

```
backend/
├── .env.example
├── .env.k8s.example
├── .gitignore
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
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
    ├── shared-types/
    ├── nats-client/
    └── redis-client/
```

---

## Common Issues

### Issue: pnpm not found
**Solution**: Install pnpm globally:
```bash
npm install -g pnpm@10.15.1
```

### Issue: Permission denied creating directories
**Solution**: Ensure you have write permissions:
```bash
chmod -R u+w backend/
```

---

## Next Steps

✅ Phase 1 Complete!

Proceed to **Phase 2**: `PHASE_2_SHARED_PACKAGES.md`
