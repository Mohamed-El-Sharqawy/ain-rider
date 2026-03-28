# backend Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-28

## Active Technologies
- TypeScript, Node.js 20+ (NestJS for auth-service) + NestJS, @nestjs/jwt, Prisma, minio client, @ain-rider/nats-client, @ain-rider/shared-types (005-driver-rider-onboarding)
- PostgreSQL (TimescaleDB) via Prisma for auth-service, MinIO for document storage (005-driver-rider-onboarding)

- TypeScript (Bun for Elysia, Node.js 20+ for NestJS) + ElysiaJS (api-gateway), NestJS (auth-service), @nestjs/jwt, Prisma (003-mobile-token-auth)
- firebase-admin, OTP provider abstraction (004-otp-provider-auth)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript (Bun for Elysia, Node.js 20+ for NestJS): Follow standard conventions

## Recent Changes
- 005-driver-rider-onboarding: Added TypeScript, Node.js 20+ (NestJS for auth-service) + NestJS, @nestjs/jwt, Prisma, minio client, @ain-rider/nats-client, @ain-rider/shared-types

- 003-mobile-token-auth: Added TypeScript (Bun for Elysia, Node.js 20+ for NestJS) + ElysiaJS (api-gateway), NestJS (auth-service), @nestjs/jwt, Prisma
- 004-otp-provider-auth: Added firebase-admin, OTP provider abstraction

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
