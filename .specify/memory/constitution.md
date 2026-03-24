<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 → 1.0.0 (MAJOR - initial constitution ratification)

Added Principles:
- I. Gateway-Centricity (new)
- II. Error Transparency (new)
- III. Unified Response Schema (new)
- IV. Transport-Agnostic Logic (new)
- V. Race Condition Prevention (new)

Added Sections:
- Technology Constraints
- Error Handling Standards

Templates requiring updates:
- .specify/templates/plan-template.md: ✅ No changes needed (Constitution Check section is generic)
- .specify/templates/spec-template.md: ✅ No changes needed (requirements section is generic)
- .specify/templates/tasks-template.md: ✅ No changes needed (task structure is generic)

Follow-up TODOs: None
-->

# 911 Ain Rider Backend Constitution

## Core Principles

### I. Gateway-Centricity

All external REST/HTTP traffic MUST pass through the Elysia `api-gateway` service.

**Non-Negotiable Rules:**
- External clients (mobile apps, web dashboards) MUST NOT call internal NestJS services directly
- Internal services (`auth-service`, `trip-service`, `payment-service`, `admin-service`) are accessible only via:
  - NATS messaging (pub/sub or request-reply)
  - Internal Docker network (for health checks and metrics scraping)
- The `api-gateway` is the ONLY service exposed on public ports
- WebSocket connections MUST route through `websocket-server` (the only other public-facing service)

**Rationale:** Single entry point simplifies security auditing, rate limiting, authentication, and enables consistent error handling across all client-facing endpoints.

### II. Error Transparency

Every service (Elysia and NestJS) MUST log errors to stdout with structured context.

**Non-Negotiable Rules:**
- Silencing errors in `catch` blocks without logging is STRICTLY FORBIDDEN
- Every caught exception MUST be logged with:
  - `serviceName`: The service where the error occurred
  - `traceId`: Request correlation ID (if available)
  - `errorType`: Exception class name or error code
  - `message`: Human-readable description
  - `stack`: Stack trace (in non-production environments)
- NATS transport errors (`TIMEOUT`, `NO_RESPONDERS`) MUST be logged at the gateway level
- Database connection failures MUST be logged with retry attempt count

**Rationale:** Silent failures are the root cause of debugging nightmares. Visibility into errors is mandatory for production reliability.

### III. Unified Response Schema

All errors reaching the frontend MUST conform to a single response format.

**Non-Negotiable Rules:**
- Success responses: `{ "success": true, "data": <payload> }`
- Error responses: `{ "success": false, "error": { "code": string, "message": string } }`
- The `code` field MUST be a machine-readable identifier (e.g., `"VALIDATION_ERROR"`, `"NOT_FOUND"`, `"SERVICE_UNAVAILABLE"`)
- The `message` field MUST be a human-readable description safe for display to end users
- Internal stack traces MUST NOT leak to the frontend in production
- HTTP status codes MUST align with error semantics:
  - `400` for validation errors
  - `401` for authentication failures
  - `403` for authorization failures
  - `404` for resource not found
  - `409` for conflict (e.g., duplicate resource)
  - `422` for business rule violations
  - `500` for unexpected server errors
  - `503` for service unavailable (NATS timeout, downstream failure)

**Rationale:** Consistent error format enables frontend developers to implement unified error handling and provides predictable UX.

### IV. Transport-Agnostic Logic

Business logic in NestJS services MUST be decoupled from transport mechanisms (HTTP, NATS).

**Non-Negotiable Rules:**
- Service classes MUST NOT import transport-specific decorators or types in their core methods
- Controllers/handlers are thin adapters that:
  1. Extract and validate input
  2. Call service methods
  3. Format responses
- Exception filters MUST catch all exceptions regardless of transport origin
- The same service method MUST work identically whether invoked via:
  - HTTP controller
  - NATS message handler
  - Direct method call in tests
- NATS request handlers MUST use the same exception handling as HTTP controllers

**Rationale:** Transport-agnostic design ensures errors are caught uniformly, simplifies testing, and allows flexible routing changes without business logic modifications.

### V. Race Condition Prevention

Concurrent operations on shared resources MUST be protected against race conditions.

**Non-Negotiable Rules:**
- **Trip Matching:** Only ONE driver can accept a trip request. Implementation MUST use:
  - Redis atomic operations (`SETNX`, `WATCH/MULTI/EXEC`) for driver assignment
  - Database-level constraints (unique index on `trip_id + driver_id`)
  - Optimistic locking with version checks
- **Driver Availability:** A driver MUST be atomically removed from the available pool when matched
- **Payment Processing:** Double-charge prevention via idempotency keys
- **User Status Changes:** Concurrent status updates MUST be serialized or use last-write-wins with audit trail
- All critical state transitions MUST be logged with before/after values

**Patterns to Apply:**
```
1. Check-then-act → Replace with atomic compare-and-swap
2. Read-modify-write → Use Redis INCR/DECR or DB transactions
3. First-come-first-served → Use Redis SETNX with TTL
```

**Rationale:** Ride-hailing systems handle concurrent requests from multiple drivers and riders. Race conditions lead to double-bookings, lost revenue, and poor user experience.

## Technology Constraints

**Runtime & Frameworks:**
- Elysia services: Bun runtime, ElysiaJS framework
- NestJS services: Node.js 20+, NestJS framework
- All services MUST use TypeScript with strict mode enabled

**Messaging:**
- NATS JetStream for all async event publishing
- NATS Request-Reply for synchronous cross-service commands
- Every NATS request MUST have a timeout (default: 3000ms)
- NATS timeouts MUST map to HTTP 503 Service Unavailable

**Data:**
- PostgreSQL with TimescaleDB for persistent storage
- Redis Cluster for shared fast state
- Prisma ORM for database access

**Observability:**
- Prometheus metrics exposed on `/metrics` endpoint
- Structured JSON logging to stdout
- Health checks on `/health` and `/ready` endpoints

## Error Handling Standards

### Gateway Layer (Elysia)

```typescript
// NATS request wrapper pattern
async function natsRequest<T>(subject: string, data: unknown, timeoutMs = 3000): Promise<T> {
  try {
    const response = await nc.request(subject, encode(data), { timeout: timeoutMs });
    return decode(response.data);
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      log('error', 'NATS timeout', { subject, timeoutMs });
      throw new ServiceUnavailableError('Service temporarily unavailable');
    }
    if (error.code === 'NO_RESPONDERS') {
      log('error', 'NATS no responders', { subject });
      throw new ServiceUnavailableError('Service not available');
    }
    throw error;
  }
}
```

### Service Layer (NestJS)

```typescript
// Global exception filter pattern
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    const { status, code, message } = this.normalizeException(exception);
    
    log('error', 'Request failed', { code, message, stack: exception?.stack });
    
    response.status(status).json({
      success: false,
      error: { code, message }
    });
  }
}
```

## Governance

This constitution supersedes all other development practices for the 911 Ain Rider backend.

**Amendment Process:**
1. Propose change with rationale in a PR
2. Document impact on existing code
3. Update all affected services before merging
4. Increment constitution version

**Compliance:**
- All PRs MUST verify compliance with these principles
- Code reviews MUST check for error handling violations
- Complexity additions MUST be justified against these principles

**Version Policy:**
- MAJOR: Principle removal or incompatible redefinition
- MINOR: New principle or significant expansion
- PATCH: Clarifications and wording improvements

**Version**: 1.0.0 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-24
