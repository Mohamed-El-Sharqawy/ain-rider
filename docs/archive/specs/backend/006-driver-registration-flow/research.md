# Research: Driver Registration Flow

**Branch**: `006-driver-registration-flow` | **Date**: 2026-03-31

## Research Tasks

### 1. Gateway Proxy Pattern for Driver Endpoints

**Decision**: Use raw `fetch` proxy forwarding Authorization header + body as-is to auth-service.

**Rationale**: Matches the existing rider upload pattern already proven in the codebase (`/auth/rider/documents/identity` and `/auth/rider/profile/image`). These endpoints use `request.arrayBuffer()` to forward the raw multipart body, preserving content-type and files. The same pattern works for all 6 driver endpoints — no new abstractions needed.

**Alternatives considered**:

- (A) NATS request-reply pattern (admin-service style with internal JWT re-signing): Rejected because NATS doesn't support streaming large multipart bodies, and it adds unnecessary complexity (internal JWT generation, admin-service as intermediary). The admin pattern is designed for JSON-only admin operations.
- (B) Create a separate dedicated driver gateway module: Rejected as over-engineering. Adding routes to the existing auth module keeps all auth-related endpoints together and follows the principle of least surprise.

### 2. License Number Collection During License Upload

**Decision**: Accept `licenseNumber` as a multipart form field alongside the 2 license image files in the existing `POST /auth/driver/documents/driving-license` endpoint.

**Rationale**: The driver already has their license in hand when photographing it — collecting the number at the same moment is the most natural UX. The existing controller already parses multipart fields and files separately (see `registerVehicle` controller method which extracts `fields` and `files` from `req.parts()`). The same pattern applies: extract `licenseNumber` from form fields, validate uniqueness, save to Driver record.

**Alternatives considered**:

- (A) Add `licenseNumber` to the initial registration form: Rejected because the driver doesn't have their license handy during phone-first registration. Adds friction to the signup flow.
- (B) Separate dedicated endpoint for license number: Rejected because it adds an extra API call and screen in the mobile app flow for no benefit.
- (C) Collect during profile completion step: Rejected because profile completion collects non-document fields; license number is document-related and should be collected with the license images.

### 3. File Size Enforcement at Gateway Level

**Decision**: Check `Content-Length` header at the gateway and reject requests exceeding 10MB before proxying. For multipart requests where individual file sizes aren't known from headers, rely on the auth-service's existing `@fastify/multipart` limits (10MB per file, 5 files max, configured in `main.ts`).

**Rationale**: The gateway operates at the HTTP level and can't parse multipart bodies without consuming them. A `Content-Length` check on the total request body is the practical boundary. Auth-service already enforces per-file limits via `@fastify/multipart` configuration. This two-tier approach (gateway checks total size, auth-service checks per-file size) provides defense in depth without duplicating multipart parsing.

**Alternatives considered**:

- (A) Parse multipart at gateway to check individual file sizes: Rejected because Elysia would need to consume the entire body, then re-serialize it for proxying — doubling memory usage and latency for large uploads.
- (B) No gateway-level enforcement, rely entirely on auth-service: Workable but contradicts FR-013 which explicitly requires gateway-level enforcement.

### 4. Duplicate License Number Validation

**Decision**: Add a uniqueness check in the `DriverOnboardingService.uploadDrivingLicense()` method before saving. Query for an existing Driver with the same `licenseNumber` (excluding the current driver) and return 409 Conflict if found.

**Rationale**: The Prisma schema already has `licenseNumber String @unique` on the Driver model, so the database will enforce uniqueness. However, the Prisma unique constraint error (P2002) returns a generic message. Adding an explicit check before the update allows returning a user-friendly error message indicating the license number is already in use.

**Alternatives considered**:

- (A) Rely solely on Prisma P2002 error: Workable but provides a less specific error message. The explicit check gives better UX.
- (B) Add a unique index check at the gateway level: Rejected because the gateway shouldn't contain business logic or database access.

### 5. Testing Strategy

**Decision**: Manual testing via curl/Postman against the running services, following the quickstart guide. Unit tests for the modified `uploadDrivingLicense` service method. Integration tests for gateway proxy routes verifying request forwarding and error handling.

**Rationale**: The existing codebase has no automated test files (no `.spec.ts` or `.test.ts` files found). The testing infrastructure (Jest) is configured but not actively used. Rather than establishing a new testing convention in this feature, focus on verifying the implementation works end-to-end through the quickstart flow.

**Alternatives considered**:

- (A) Comprehensive unit + integration test suite: Ideal but out of scope for this feature. Would require establishing testing patterns for both NestJS and ElysiaJS services.
- (B) E2E tests with test containers: Valuable but significant setup investment. Better suited for a dedicated testing infrastructure feature.

## Resolved NEEDS CLARIFICATION

All technical unknowns resolved. No items remain unresolved from the Technical Context.
