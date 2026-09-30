# Feature Specification: Error Handling Layer

**Feature Branch**: `001-error-handling-layer`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Error Logic Baseline - Define technical specs for Error Handling Layer with Elysia Gateway global error handler, NestJS GlobalExceptionFilter, structured logging with traceId, and NATS timeout handling"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Frontend Receives Consistent Error Responses (Priority: P1)

As a frontend developer, when any backend service fails (validation error, service unavailable, internal error), I receive a consistent JSON error response format so I can implement unified error handling in the mobile and web apps.

**Why this priority**: This is the foundation of the entire error handling system. Without consistent error responses, frontend cannot reliably display errors to users, leading to poor UX and increased support burden.

**Independent Test**: Send requests that trigger various error types (validation, auth, service down) and verify all responses match the unified schema `{ success: false, error: { code, message } }`.

**Acceptance Scenarios**:

1. **Given** a validation error occurs in any service, **When** the response reaches the frontend, **Then** the response body contains `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "<human-readable details>" } }` with HTTP status 400.

2. **Given** an internal NestJS service throws an unhandled exception, **When** the response reaches the frontend, **Then** the response body contains `{ "success": false, "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred" } }` with HTTP status 500, and no stack trace is exposed.

3. **Given** a NATS request-reply times out, **When** the response reaches the frontend, **Then** the response body contains `{ "success": false, "error": { "code": "SERVICE_UNAVAILABLE", "message": "Service temporarily unavailable" } }` with HTTP status 503.

---

### User Story 2 - Developers Can Debug Errors via Logs (Priority: P2)

As a backend developer, when an error occurs in any service, I can find the complete error context in the logs including the service name, trace ID, error type, and stack trace, so I can quickly diagnose and fix issues.

**Why this priority**: Error visibility is critical for production debugging. Without structured logs, developers waste hours tracing issues across microservices.

**Independent Test**: Trigger errors in each service and verify logs contain all required fields (serviceName, traceId, errorType, message, stack in non-production).

**Acceptance Scenarios**:

1. **Given** an error occurs in any Elysia service, **When** the error is logged, **Then** the log entry includes `serviceName`, `traceId` (if present in request), `errorType`, `message`, and `stack` (in development mode).

2. **Given** an error occurs in any NestJS service, **When** the error is logged, **Then** the log entry includes the same structured fields as Elysia services.

3. **Given** a NATS timeout occurs at the gateway, **When** the timeout is logged, **Then** the log includes `serviceName: "api-gateway"`, `errorType: "NATS_TIMEOUT"`, the target subject, and the timeout duration.

---

### User Story 3 - Gateway Handles Downstream Service Failures Gracefully (Priority: P2)

As a system operator, when a downstream NestJS service is unavailable or slow, the API Gateway returns a proper error response within a bounded time instead of hanging indefinitely, so the system remains responsive.

**Why this priority**: Hanging requests consume resources and create cascading failures. Bounded timeouts with proper error responses maintain system stability.

**Independent Test**: Stop a downstream service and verify the gateway returns 503 within the configured timeout period.

**Acceptance Scenarios**:

1. **Given** a downstream service is not responding, **When** the gateway sends a NATS request, **Then** the gateway returns HTTP 503 within 3 seconds (default timeout).

2. **Given** a downstream service has no responders registered, **When** the gateway sends a NATS request, **Then** the gateway immediately returns HTTP 503 with code `SERVICE_UNAVAILABLE`.

3. **Given** a downstream service returns an error via NATS reply, **When** the gateway receives the error, **Then** the gateway maps it to the appropriate HTTP status code and unified response format.

---

### User Story 4 - NestJS Services Handle Both HTTP and NATS Errors Uniformly (Priority: P3)

As a backend developer, when I write business logic in a NestJS service, the same exception handling applies whether the request came via HTTP controller or NATS message handler, so I don't need to duplicate error handling code.

**Why this priority**: Transport-agnostic error handling reduces code duplication and ensures consistent behavior regardless of how the service is invoked.

**Independent Test**: Throw the same exception from both an HTTP endpoint and a NATS handler, verify both produce identical error responses.

**Acceptance Scenarios**:

1. **Given** a service method throws a business exception, **When** invoked via HTTP controller, **Then** the GlobalExceptionFilter catches it and returns the unified error response.

2. **Given** the same service method throws the same exception, **When** invoked via NATS message handler, **Then** the same filter catches it and returns the unified error response via NATS reply.

---

### Edge Cases

- What happens when the logger itself fails (e.g., stdout blocked)? System MUST NOT crash; errors should be buffered or dropped gracefully.
- What happens when an error message contains sensitive data (passwords, tokens)? System MUST sanitize error messages before logging and responding.
- What happens when multiple errors occur in a single request (e.g., multiple validation failures)? System MUST aggregate them into a single response with all error details.
- What happens when a NATS reply contains malformed JSON? Gateway MUST return 502 Bad Gateway with appropriate error code.
- What happens when the traceId header is missing? System MUST generate a new traceId and include it in all logs for that request.

## Requirements *(mandatory)*

### Functional Requirements

**Gateway Error Handling (Elysia)**

- **FR-001**: API Gateway MUST implement a global `.onError()` handler that catches all unhandled exceptions.
- **FR-002**: Gateway MUST map NATS `TIMEOUT` errors to HTTP 503 with error code `SERVICE_UNAVAILABLE`.
- **FR-003**: Gateway MUST map NATS `NO_RESPONDERS` errors to HTTP 503 with error code `SERVICE_UNAVAILABLE`.
- **FR-004**: Gateway MUST enforce a configurable timeout (default 3000ms) on all NATS request-reply calls.
- **FR-005**: Gateway MUST never expose internal stack traces in production error responses.

**Service Error Handling (NestJS)**

- **FR-006**: Each NestJS service MUST implement a GlobalExceptionFilter that catches all exceptions.
- **FR-007**: GlobalExceptionFilter MUST handle both `HttpException` and standard JavaScript errors.
- **FR-008**: GlobalExceptionFilter MUST return errors in the unified response schema via both HTTP and NATS reply.
- **FR-009**: Service exceptions MUST be logged before being returned to the caller.

**Unified Response Schema**

- **FR-010**: All error responses MUST conform to: `{ "success": false, "error": { "code": string, "message": string, "traceId": string } }`.
- **FR-011**: Error `code` MUST be a machine-readable uppercase identifier (e.g., `VALIDATION_ERROR`, `NOT_FOUND`).
- **FR-012**: Error `message` MUST be a human-readable string safe for display to end users.
- **FR-013**: HTTP status codes MUST align with error semantics (400 validation, 401 auth, 403 forbidden, 404 not found, 409 conflict, 422 business rule, 500 internal, 503 unavailable).

**Structured Logging**

- **FR-014**: All services MUST log errors to stdout in structured JSON format.
- **FR-015**: Every error log MUST include: `serviceName`, `errorType`, `message`, `timestamp`.
- **FR-016**: Error logs MUST include `traceId` when available in the request context.
- **FR-017**: Error logs MUST include `stack` trace in non-production environments.
- **FR-018**: Silencing errors in catch blocks without logging is FORBIDDEN.

**Trace ID Propagation**

- **FR-019**: Gateway MUST extract or generate a `traceId` for each incoming request.
- **FR-020**: Gateway MUST propagate `traceId` to downstream services via NATS message headers.
- **FR-021**: All services MUST include `traceId` in their log entries for request correlation.

**Sensitive Data Sanitization**

- **FR-022**: Error messages MUST be automatically sanitized for sensitive patterns before logging and responding.
- **FR-023**: Predefined sanitization patterns MUST include: password, token, secret, key, authorization, credential, apikey.
- **FR-024**: Sanitized values MUST be replaced with `[REDACTED]` in logs and error messages.

### Key Entities

- **ErrorResponse**: The unified error response structure containing success flag, error code, message, and traceId.
- **TraceContext**: Request correlation context containing traceId, serviceName, and timestamp.
- **LogEntry**: Structured log record with all required fields for error visibility.
- **SanitizationConfig**: Configuration for automatic sensitive data redaction patterns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of error responses from all services conform to the unified schema `{ success, error: { code, message, traceId } }`.
- **SC-002**: 100% of errors are logged with serviceName, errorType, message, and traceId (when available).
- **SC-003**: NATS timeouts return HTTP 503 within 3.5 seconds (3s timeout + 500ms overhead) instead of hanging.
- **SC-004**: Zero stack traces are exposed in production error responses.
- **SC-005**: Developers can trace a request across all services using a single traceId within 30 seconds.
- **SC-006**: No silent error swallowing exists in any catch block across the codebase.

## Assumptions

- Pino will be used as the logging library (fastest, native JSON, works in Bun + Node).
- NATS JetStream is already configured and operational.
- The existing Elysia `.onError()` handler will be extended, not replaced.
- NestJS services currently use class-validator/class-transformer which will be replaced with TypeBox.
- TraceId will be passed via `X-Trace-Id` HTTP header and NATS message headers.

## Clarifications

### Session 2026-03-24

- Q: Which schema validation library for shared Error Schema? → A: TypeBox (replacing class-validator/class-transformer in NestJS)
- Q: Which structured logging library? → A: Pino (fastest, native JSON, works in Bun + Node)
- Q: Include traceId in error responses? → A: Yes, include traceId in all error responses for frontend debugging
- Q: Where to locate shared Error Schema? → A: New `packages/error-handling` package (contains types AND utilities/logic)
- Q: Sensitive data sanitization approach? → A: Automatic with predefined patterns (password, token, secret, key, authorization)
