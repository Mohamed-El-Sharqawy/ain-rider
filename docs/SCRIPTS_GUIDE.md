# Backend Scripts Guide

## Overview
All build, clean, docker, and prisma commands are now PowerShell-compatible using Node.js scripts instead of shell operators (`&&`, `||`).

---

## Available Commands

### Development
```bash
# Start all services in parallel (dev mode with watch)
pnpm dev

# Start specific service
cd apps/nest/auth-service
pnpm dev

cd apps/elysia/api-gateway
bun --watch src/index.ts
```

### Building

#### Build Shared Packages
```bash
pnpm build:packages
```
Builds in order:
1. `@ain-rider/shared-types`
2. `@ain-rider/nats-client`
3. `@ain-rider/redis-client`

**Script**: `scripts/build-packages.mjs`

#### Build All Services
```bash
pnpm build

# Or specify specific services
pnpm build auth-service trip-service
```

**Script**: `scripts/build.mjs`

### Prisma Commands

#### Generate Prisma Clients
```bash
pnpm prisma:generate
```
Generates Prisma Client for all services:
- `@ain-rider/auth-service`
- `@ain-rider/trip-service`
- `@ain-rider/payment-service`
- `@ain-rider/admin-service`

**When to use**:
- After modifying any `schema.prisma` file
- After `pnpm install` (also runs via `postinstall` hook)
- Before building services

**Script**: `scripts/prisma-generate.mjs`

**Output**: Generates TypeScript client in `src/generated/prisma/` for each service

#### Push Schemas to Database
```bash
pnpm prisma:push
```
Applies schema changes directly to the database for all services (no migrations).

**When to use**:
- During development (prototyping schemas)
- When you want to quickly sync DB with schema changes
- **NOT for production** (use migrations instead)

**Script**: `scripts/prisma-push.mjs`

**⚠️ Warning**: This command:
- Applies changes directly without creating migration files
- May cause data loss if you remove/rename fields
- Should only be used in development

#### For Production (Migrations)
```bash
# Create migration for a specific service
cd apps/nest/auth-service
pnpm prisma:migrate

# Deploy migrations in production
cd apps/nest/auth-service
pnpm prisma:deploy
```

### Cleaning

#### Clean Build Artifacts
```bash
pnpm clean
```
Removes `dist/` and `build/` folders from all services.

**Script**: `scripts/clean.mjs`

#### Clean Everything
```bash
pnpm clean:all
```
Removes all build artifacts AND `node_modules/`.

**Script**: `scripts/clean.mjs` (with additional cleanup)

### Docker Commands

#### Build NestJS Service Images
```bash
pnpm docker:build:nest
```
Builds Docker images for:
- `ainrider/auth-service:local`
- `ainrider/trip-service:local`
- `ainrider/payment-service:local`
- `ainrider/admin-service:local`

**Script**: `scripts/docker-build-nest.mjs`

#### Build Elysia Service Images
```bash
pnpm docker:build:elysia
```
Builds Docker images for:
- `ainrider/api-gateway:local`
- `ainrider/websocket-server:local`
- `ainrider/location-service:local`
- `ainrider/match-service:local`

**Script**: `scripts/docker-build-elysia.mjs`

#### Build All Docker Images
```bash
pnpm docker:build:all
```
Builds all Elysia and NestJS service images.

**Script**: `scripts/docker-build-all.mjs`

### Infrastructure (Docker Compose)

#### Start Infrastructure
```bash
pnpm docker:infra:up
```
Starts:
- PostgreSQL + PgBouncer
- Redis Cluster
- NATS JetStream
- MinIO (S3-compatible storage)

#### Stop Infrastructure
```bash
pnpm docker:infra:down
```

#### Clean Infrastructure (Remove Volumes)
```bash
pnpm docker:infra:clean
```
⚠️ **Warning**: This removes all data (databases, Redis, MinIO files)

#### View Infrastructure Logs
```bash
pnpm docker:infra:logs
```

### Testing & Linting

#### Run All Tests
```bash
pnpm test
```

#### Run Linter
```bash
pnpm lint
```

---

## Typical Workflows

### Initial Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Build shared packages
pnpm build:packages

# 3. Start infrastructure
pnpm docker:infra:up

# 4. Generate Prisma clients
pnpm prisma:generate

# 5. Push schemas to database
pnpm prisma:push

# 6. Start services
pnpm dev
```

### After Schema Changes
```bash
# 1. Edit schema.prisma in any service
# 2. Generate Prisma client
pnpm prisma:generate

# 3. Push to database (dev only)
pnpm prisma:push

# 4. Rebuild the service
pnpm build auth-service  # or whichever service you modified
```

### Before Committing
```bash
# 1. Clean build artifacts
pnpm clean

# 2. Run linter
pnpm lint

# 3. Run tests
pnpm test

# 4. Build all services
pnpm build

# 5. Verify Prisma clients are up to date
pnpm prisma:generate
```

### Production Deployment
```bash
# 1. Build packages
pnpm build:packages

# 2. Generate Prisma clients
pnpm prisma:generate

# 3. Build Docker images
pnpm docker:build:all

# 4. Deploy migrations (not db push!)
cd apps/nest/auth-service
pnpm prisma:deploy
```

---

## Script Architecture

All scripts follow this pattern:

```javascript
#!/usr/bin/env node
import { execSync } from 'child_process';

const services = ['service1', 'service2'];

for (const service of services) {
  try {
    console.log(`📦 Processing ${service}...`);
    execSync(`pnpm --filter ${service} command`, {
      stdio: 'inherit',  // Show output in real-time
      cwd: process.cwd(),
    });
    console.log(`✅ ${service} completed\n`);
  } catch (error) {
    console.error(`❌ ${service} failed`);
    process.exit(1);  // Stop on first failure
  }
}
```

**Benefits**:
- ✅ Works on Windows (PowerShell), macOS, Linux
- ✅ No shell operator issues (`&&`, `||`, `;`)
- ✅ Clear progress output with emojis
- ✅ Fails fast on first error
- ✅ Easy to extend and modify

---

## Service-Specific Commands

Each NestJS service has these scripts in its `package.json`:

```json
{
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start:prod": "node dist/main",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

Run them directly:
```bash
cd apps/nest/auth-service
pnpm prisma:generate  # Generate client for this service only
pnpm prisma:push      # Push schema for this service only
```

---

## Prisma Workflow

### Development (Prototyping)
```bash
# 1. Edit schema.prisma
# 2. Push changes directly to DB
pnpm prisma:push

# 3. Generate client
pnpm prisma:generate
```

### Production (Migrations)
```bash
# 1. Edit schema.prisma
# 2. Create migration
cd apps/nest/auth-service
pnpm prisma:migrate

# 3. Review migration SQL in prisma/migrations/
# 4. Commit migration files to git
# 5. Deploy in production
pnpm prisma:deploy
```

---

## Troubleshooting

### "Prisma Client not found"
```bash
pnpm prisma:generate
```

### "Schema out of sync with database"
```bash
pnpm prisma:push
```

### "Build fails with Prisma errors"
```bash
# 1. Clean everything
pnpm clean

# 2. Regenerate Prisma clients
pnpm prisma:generate

# 3. Rebuild
pnpm build
```

### "Docker build fails"
```bash
# Build packages first (required for Docker builds)
pnpm build:packages

# Then build Docker images
pnpm docker:build:all
```

---

## Environment Variables

All scripts respect these environment variables:

```bash
# Database (required for prisma:push)
DATABASE_URL=postgresql://user:pass@localhost:5432/ainrider

# Service ports (optional, has defaults)
AUTH_SERVICE_PORT=4000
TRIP_SERVICE_PORT=4001
PAYMENT_SERVICE_PORT=4002
ADMIN_SERVICE_PORT=4003
API_GATEWAY_PORT=3000

# Infrastructure
REDIS_NODES=localhost:6379
NATS_URL=nats://localhost:4222
MINIO_ENDPOINT=localhost:9000
```

Set them in `.env` files or export them before running commands.

---

## Quick Reference

| Command | Description | When to Use |
|---------|-------------|-------------|
| `pnpm dev` | Start all services | Daily development |
| `pnpm build` | Build all services | Before commit, CI/CD |
| `pnpm build:packages` | Build shared packages | After modifying packages |
| `pnpm clean` | Remove build artifacts | Clean slate, troubleshooting |
| `pnpm prisma:generate` | Generate Prisma clients | After schema changes |
| `pnpm prisma:push` | Sync DB with schemas | Dev prototyping |
| `pnpm docker:build:all` | Build all Docker images | Deployment prep |
| `pnpm docker:infra:up` | Start local infrastructure | First time setup |
| `pnpm test` | Run all tests | Before commit, CI/CD |
| `pnpm lint` | Run linter | Before commit, CI/CD |

---

All scripts are cross-platform and work on Windows, macOS, and Linux! 🚀
