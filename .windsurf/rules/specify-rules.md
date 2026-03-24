# backend Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-24

## Active Technologies
- TypeScript 5.x (strict mode), Node.js 20+ (NestJS), Bun (Elysia) + NATS JetStream, @ain-rider/nats-client, Prisma ORM, H3 (geospatial) (002-nats-interservice-refactor)
- PostgreSQL + TimescaleDB (persistent), Redis Cluster (state/cache) (002-nats-interservice-refactor)

- TypeScript 5.x (strict mode) + TypeBox (schema validation), Pino (logging), NATS (messaging) (001-error-handling-layer)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 002-nats-interservice-refactor: Added TypeScript 5.x (strict mode), Node.js 20+ (NestJS), Bun (Elysia) + NATS JetStream, @ain-rider/nats-client, Prisma ORM, H3 (geospatial)

- 001-error-handling-layer: Added TypeScript 5.x (strict mode) + TypeBox (schema validation), Pino (logging), NATS (messaging)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
