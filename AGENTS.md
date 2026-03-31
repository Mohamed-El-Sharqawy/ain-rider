# backend Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-31

## Active Technologies
- TypeScript, Node.js 20+ (NestJS for auth-service) + NestJS, @nestjs/jwt, Prisma, minio client, @ain-rider/nats-client, @ain-rider/shared-types (005-driver-rider-onboarding)
- PostgreSQL (TimescaleDB) via Prisma for auth-service, MinIO for document storage (005-driver-rider-onboarding)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (006-driver-registration-flow)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (006-driver-registration-flow)
- TypeScript, Node.js 20+ (NestJS for auth-service), Bun (ElysiaJS for api-gateway) + NestJS, ElysiaJS, Prisma, @ain-rider/minio-client, @ain-rider/nats-client, @ain-rider/shared-types, @fastify/multipart, passport-jwt, class-validator (006-driver-registration-flow)
- PostgreSQL (TimescaleDB) via Prisma for auth-service; MinIO for object storage (bucket: `ain-rider`) (006-driver-registration-flow)

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
- 006-driver-registration-flow: Added TypeScript, Node.js 20+ (NestJS for auth-service), Bun (ElysiaJS for api-gateway) + NestJS, ElysiaJS, Prisma, @ain-rider/minio-client, @ain-rider/nats-client, @ain-rider/shared-types, @fastify/multipart, passport-jwt, class-validator
- 006-driver-registration-flow: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 005-driver-rider-onboarding: Added TypeScript, Node.js 20+ (NestJS for auth-service) + NestJS, @nestjs/jwt, Prisma, minio client, @ain-rider/nats-client, @ain-rider/shared-types


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
