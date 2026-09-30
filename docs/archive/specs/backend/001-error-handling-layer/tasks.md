# Tasks: Error Handling Layer

**Input**: Design documents from `/specs/001-error-handling-layer/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/error-response.json, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Shared package**: `packages/error-handling/src/`
- **Elysia services**: `apps/elysia/{service}/src/`
- **NestJS services**: `apps/nest/{service}/src/`

---

## Phase 1: Setup (Shared Package Initialization)

**Purpose**: Create the `packages/error-handling` shared package structure

- [ ] T001 Create package directory structure at `packages/error-handling/`
- [ ] T002 Initialize package.json with name `@ain-rider/error-handling` at `packages/error-handling/package.json`
  ```json
  {
    "name": "@ain-rider/error-handling",
    "version": "1.0.0",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "scripts": {
      "build": "tsc",
      "dev": "tsc --watch"
    },
    "dependencies": {
      "@sinclair/typebox": "^0.32.0",
      "pino": "^8.19.0"
    },
    "peerDependencies": {
      "nats": "^2.19.0"
    }
  }
  ```
- [ ] T003 [P] Create tsconfig.json with strict mode at `packages/error-handling/tsconfig.json`
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "declaration": true,
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true
    },
    "include": ["src/**/*"]
  }
  ```
- [ ] T004 [P] Create empty index.ts barrel file at `packages/error-handling/src/index.ts`

**Checkpoint**: Package structure ready for implementation

---

## Phase 2: Foundational (Core Types & Utilities)

**Purpose**: Implement core schemas, error classes, and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Error Codes & Schemas

- [ ] T005 Create ErrorCodes constant object at `packages/error-handling/src/schemas/error-codes.ts`
  ```typescript
  // Define all error codes as const object:
  // VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT,
  // BUSINESS_RULE_VIOLATION, INTERNAL_ERROR, SERVICE_UNAVAILABLE,
  // BAD_GATEWAY, NATS_TIMEOUT, NATS_NO_RESPONDERS
  // Also export ErrorCodeToHttpStatus mapping
  ```

- [ ] T006 Create TypeBox ErrorResponse schema at `packages/error-handling/src/schemas/error-response.ts`
  ```typescript
  // Import Type, Static from @sinclair/typebox
  // Define ErrorResponseSchema with: success (literal false), error object
  // error object contains: code (string), message (string), traceId (string uuid)
  // Export type ErrorResponse = Static<typeof ErrorResponseSchema>
  ```

- [ ] T007 [P] Create TypeBox TraceContext schema at `packages/error-handling/src/schemas/trace-context.ts`
  ```typescript
  // Define TraceContextSchema with: traceId (uuid), serviceName (string), timestamp (date-time)
  // Export type TraceContext = Static<typeof TraceContextSchema>
  ```

- [ ] T008 Create schemas barrel export at `packages/error-handling/src/schemas/index.ts`
  ```typescript
  export * from './error-codes';
  export * from './error-response';
  export * from './trace-context';
  ```

### Error Classes

- [ ] T009 Create base AppError class at `packages/error-handling/src/errors/app-error.ts`
  ```typescript
  // Import ErrorCode, ErrorCodeToHttpStatus, ErrorResponse from schemas
  // Class AppError extends Error with:
  //   - code: ErrorCode
  //   - httpStatus: number (from mapping)
  //   - details?: unknown
  //   - timestamp: string (ISO)
  // Method toResponse(traceId: string): ErrorResponse
  ```

- [ ] T010 [P] Create ValidationError class at `packages/error-handling/src/errors/validation-error.ts`
  ```typescript
  // Extends AppError, sets code to VALIDATION_ERROR
  // Constructor takes message and optional details
  ```

- [ ] T011 [P] Create NotFoundError class at `packages/error-handling/src/errors/not-found-error.ts`
  ```typescript
  // Extends AppError, sets code to NOT_FOUND
  // Constructor takes resource name and optional identifier
  // Generates message like "Trip with ID '123' not found"
  ```

- [ ] T012 [P] Create UnauthorizedError class at `packages/error-handling/src/errors/unauthorized-error.ts`
  ```typescript
  // Extends AppError, sets code to UNAUTHORIZED
  // Default message: "Authentication required"
  ```

- [ ] T013 [P] Create ForbiddenError class at `packages/error-handling/src/errors/forbidden-error.ts`
  ```typescript
  // Extends AppError, sets code to FORBIDDEN
  // Default message: "Access denied"
  ```

- [ ] T014 [P] Create ServiceUnavailableError class at `packages/error-handling/src/errors/service-unavailable-error.ts`
  ```typescript
  // Extends AppError, sets code to SERVICE_UNAVAILABLE
  // Default message: "Service temporarily unavailable"
  ```

- [ ] T015 [P] Create InternalError class at `packages/error-handling/src/errors/internal-error.ts`
  ```typescript
  // Extends AppError, sets code to INTERNAL_ERROR
  // Default message: "An unexpected error occurred"
  ```

- [ ] T016 [P] Create BusinessRuleError class at `packages/error-handling/src/errors/business-rule-error.ts`
  ```typescript
  // Extends AppError, sets code to BUSINESS_RULE_VIOLATION
  // Constructor takes message and optional details
  ```

- [ ] T017 [P] Create ConflictError class at `packages/error-handling/src/errors/conflict-error.ts`
  ```typescript
  // Extends AppError, sets code to CONFLICT
  // Constructor takes message and optional details
  ```

- [ ] T018 Create errors barrel export at `packages/error-handling/src/errors/index.ts`
  ```typescript
  export * from './app-error';
  export * from './validation-error';
  export * from './not-found-error';
  export * from './unauthorized-error';
  export * from './forbidden-error';
  export * from './service-unavailable-error';
  export * from './internal-error';
  export * from './business-rule-error';
  export * from './conflict-error';
  ```

### Sensitive Data Sanitizer

- [ ] T019 Create sanitizer utility at `packages/error-handling/src/logger/sanitizer.ts`
  ```typescript
  // Define SENSITIVE_PATTERNS array of regex: password, token, secret, key, authorization, credential, apikey, api_key, bearer
  // Export function sanitize(obj: unknown): unknown
  //   - If object, iterate keys and replace matching values with '[REDACTED]'
  //   - Recursively sanitize nested objects
  //   - Return primitives unchanged
  ```

### Pino Logger

- [ ] T020 Create Pino logger wrapper at `packages/error-handling/src/logger/pino-logger.ts`
  ```typescript
  // Import pino from 'pino'
  // Import sanitize from './sanitizer'
  // Export interface LoggerConfig { serviceName: string; level?: string }
  // Export function createLogger(config: LoggerConfig): pino.Logger
  //   - Configure with JSON format, ISO timestamps
  //   - Add serviceName to base context
  //   - Return configured pino instance
  // Export function logError(logger: pino.Logger, error: unknown, context: { traceId?: string }): void
  //   - Sanitize error details before logging
  //   - Include stack trace only if NODE_ENV !== 'production'
  ```

- [ ] T021 Create logger barrel export at `packages/error-handling/src/logger/index.ts`
  ```typescript
  export * from './pino-logger';
  export * from './sanitizer';
  ```

### TraceId Utilities

- [ ] T022 Create trace utilities at `packages/error-handling/src/middleware/trace-middleware.ts`
  ```typescript
  // Export function generateTraceId(): string
  //   - Return crypto.randomUUID()
  // Export function extractTraceId(headers: Headers | Record<string, string>): string | null
  //   - Check for 'X-Trace-Id' or 'x-trace-id' header
  //   - Return value or null
  ```

### Error Mapper

- [ ] T023 Create error mapper utility at `packages/error-handling/src/middleware/error-mapper.ts`
  ```typescript
  // Import AppError, InternalError from errors
  // Export function normalizeError(error: unknown): AppError
  //   - If already AppError, return as-is
  //   - If Error with message, wrap in InternalError
  //   - Otherwise create generic InternalError
  // Export function mapHttpExceptionToAppError(httpException: any): AppError
  //   - Map NestJS HttpException status codes to appropriate AppError subclass
  ```

- [ ] T024 Create middleware barrel export at `packages/error-handling/src/middleware/index.ts`
  ```typescript
  export * from './trace-middleware';
  export * from './error-mapper';
  ```

### Update Main Index

- [ ] T025 Update main index.ts with all exports at `packages/error-handling/src/index.ts`
  ```typescript
  export * from './schemas';
  export * from './errors';
  export * from './logger';
  export * from './middleware';
  // Note: NATS utilities will be added in Phase 3 (US3)
  ```

### Build & Verify

- [ ] T026 Run `pnpm install` in `packages/error-handling/` to install dependencies
- [ ] T027 Run `pnpm build` in `packages/error-handling/` to compile TypeScript and verify no errors

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Consistent Error Responses (Priority: P1) 🎯 MVP

**Goal**: Frontend receives unified error response format `{ success: false, error: { code, message, traceId } }` from all services

**Independent Test**: Send requests that trigger validation, auth, and internal errors - verify all match the unified schema

**Success Criteria**: SC-001 (100% unified schema), SC-004 (zero stack traces in production)

### Implementation for User Story 1

- [ ] T028 [US1] Add @ain-rider/error-handling dependency to api-gateway at `apps/elysia/api-gateway/package.json`
  ```bash
  # Run: pnpm add @ain-rider/error-handling
  ```

- [ ] T029 [US1] Create global error handler for Elysia at `apps/elysia/api-gateway/src/shared/error-handler.ts`
  ```typescript
  // Import Elysia from 'elysia'
  // Import { AppError, InternalError, normalizeError, logError, createLogger } from '@ain-rider/error-handling'
  // 
  // const logger = createLogger({ serviceName: 'api-gateway' });
  //
  // Export errorHandler as Elysia plugin:
  //   .onError(({ error, set, store }) => {
  //     const traceId = store.traceId || 'unknown';
  //     const appError = normalizeError(error);
  //     logError(logger, appError, { traceId });
  //     set.status = appError.httpStatus;
  //     return appError.toResponse(traceId);
  //   })
  ```

- [ ] T030 [US1] Create trace middleware for Elysia at `apps/elysia/api-gateway/src/shared/trace.ts`
  ```typescript
  // Import Elysia from 'elysia'
  // Import { generateTraceId, extractTraceId } from '@ain-rider/error-handling'
  //
  // Export traceMiddleware as Elysia plugin:
  //   .derive(({ request, store }) => {
  //     const traceId = extractTraceId(request.headers) || generateTraceId();
  //     store.traceId = traceId;
  //     return { traceId };
  //   })
  ```

- [ ] T031 [US1] Register error handler and trace middleware in api-gateway at `apps/elysia/api-gateway/src/index.ts`
  ```typescript
  // Add imports:
  // import { traceMiddleware } from './shared/trace';
  // import { errorHandler } from './shared/error-handler';
  //
  // Update Elysia app chain (add BEFORE other plugins):
  // new Elysia()
  //   .use(traceMiddleware)
  //   .use(errorHandler)
  //   // ... existing plugins
  ```

- [ ] T032 [US1] Add @ain-rider/error-handling dependency to auth-service at `apps/nest/auth-service/package.json`
  ```bash
  # Run: pnpm add @ain-rider/error-handling
  ```

- [ ] T033 [US1] Create GlobalExceptionFilter for NestJS at `apps/nest/auth-service/src/shared/filters/global-exception.filter.ts`
  ```typescript
  // Import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common'
  // Import { AppError, normalizeError, mapHttpExceptionToAppError, logError, createLogger } from '@ain-rider/error-handling'
  //
  // const logger = createLogger({ serviceName: 'auth-service' });
  //
  // @Catch()
  // export class GlobalExceptionFilter implements ExceptionFilter {
  //   catch(exception: unknown, host: ArgumentsHost) {
  //     const ctx = host.switchToHttp();
  //     const response = ctx.getResponse();
  //     const request = ctx.getRequest();
  //     const traceId = request.traceId || 'unknown';
  //
  //     let appError: AppError;
  //     if (exception instanceof HttpException) {
  //       appError = mapHttpExceptionToAppError(exception);
  //     } else {
  //       appError = normalizeError(exception);
  //     }
  //
  //     logError(logger, appError, { traceId });
  //     response.status(appError.httpStatus).json(appError.toResponse(traceId));
  //   }
  // }
  ```

- [ ] T034 [US1] Create TraceInterceptor for NestJS at `apps/nest/auth-service/src/shared/interceptors/trace.interceptor.ts`
  ```typescript
  // Import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
  // Import { Observable } from 'rxjs'
  // Import { generateTraceId, extractTraceId } from '@ain-rider/error-handling'
  //
  // @Injectable()
  // export class TraceInterceptor implements NestInterceptor {
  //   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  //     const request = context.switchToHttp().getRequest();
  //     request.traceId = extractTraceId(request.headers) || generateTraceId();
  //     return next.handle();
  //   }
  // }
  ```

- [ ] T035 [US1] Register GlobalExceptionFilter and TraceInterceptor in auth-service at `apps/nest/auth-service/src/main.ts`
  ```typescript
  // Add imports:
  // import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
  // import { TraceInterceptor } from './shared/interceptors/trace.interceptor';
  //
  // In bootstrap function, add:
  // app.useGlobalInterceptors(new TraceInterceptor());
  // app.useGlobalFilters(new GlobalExceptionFilter());
  ```

- [ ] T036 [US1] Copy GlobalExceptionFilter to trip-service at `apps/nest/trip-service/src/shared/filters/global-exception.filter.ts`
  ```typescript
  // Same as auth-service but change serviceName to 'trip-service'
  ```

- [ ] T037 [US1] Copy TraceInterceptor to trip-service at `apps/nest/trip-service/src/shared/interceptors/trace.interceptor.ts`

- [ ] T038 [US1] Register filter and interceptor in trip-service at `apps/nest/trip-service/src/main.ts`

- [ ] T039 [US1] Copy GlobalExceptionFilter to payment-service at `apps/nest/payment-service/src/shared/filters/global-exception.filter.ts`
  ```typescript
  // Same as auth-service but change serviceName to 'payment-service'
  ```

- [ ] T040 [US1] Copy TraceInterceptor to payment-service at `apps/nest/payment-service/src/shared/interceptors/trace.interceptor.ts`

- [ ] T041 [US1] Register filter and interceptor in payment-service at `apps/nest/payment-service/src/main.ts`

- [ ] T042 [US1] Copy GlobalExceptionFilter to admin-service at `apps/nest/admin-service/src/shared/filters/global-exception.filter.ts`
  ```typescript
  // Same as auth-service but change serviceName to 'admin-service'
  ```

- [ ] T043 [US1] Copy TraceInterceptor to admin-service at `apps/nest/admin-service/src/shared/interceptors/trace.interceptor.ts`

- [ ] T044 [US1] Register filter and interceptor in admin-service at `apps/nest/admin-service/src/main.ts`

**Checkpoint**: User Story 1 complete - all services return unified error responses

---

## Phase 4: User Story 2 - Structured Logging (Priority: P2)

**Goal**: All errors are logged with serviceName, traceId, errorType, message, and stack (in dev)

**Independent Test**: Trigger errors and verify log output contains all required fields in JSON format

**Success Criteria**: SC-002 (100% structured logs), SC-006 (no silent error swallowing)

### Implementation for User Story 2

- [ ] T045 [US2] Add @ain-rider/error-handling dependency to location-service at `apps/elysia/location-service/package.json`
  ```bash
  # Run: pnpm add @ain-rider/error-handling
  ```

- [ ] T046 [US2] Create error handler for location-service at `apps/elysia/location-service/src/shared/error-handler.ts`
  ```typescript
  // Same pattern as api-gateway but serviceName: 'location-service'
  ```

- [ ] T047 [US2] Create trace middleware for location-service at `apps/elysia/location-service/src/shared/trace.ts`

- [ ] T048 [US2] Register error handler and trace in location-service at `apps/elysia/location-service/src/index.ts`

- [ ] T049 [US2] Add @ain-rider/error-handling dependency to match-service at `apps/elysia/match-service/package.json`

- [ ] T050 [US2] Create error handler for match-service at `apps/elysia/match-service/src/shared/error-handler.ts`
  ```typescript
  // Same pattern as api-gateway but serviceName: 'match-service'
  ```

- [ ] T051 [US2] Create trace middleware for match-service at `apps/elysia/match-service/src/shared/trace.ts`

- [ ] T052 [US2] Register error handler and trace in match-service at `apps/elysia/match-service/src/index.ts`

- [ ] T053 [US2] Add @ain-rider/error-handling dependency to websocket-server at `apps/elysia/websocket-server/package.json`

- [ ] T054 [US2] Create error handler for websocket-server at `apps/elysia/websocket-server/src/shared/error-handler.ts`
  ```typescript
  // Same pattern as api-gateway but serviceName: 'websocket-server'
  ```

- [ ] T055 [US2] Create trace middleware for websocket-server at `apps/elysia/websocket-server/src/shared/trace.ts`

- [ ] T056 [US2] Register error handler and trace in websocket-server at `apps/elysia/websocket-server/src/index.ts`

**Checkpoint**: User Story 2 complete - all 8 services have structured logging

---

## Phase 5: User Story 3 - NATS Timeout Handling (Priority: P2)

**Goal**: Gateway returns HTTP 503 within 3 seconds when downstream services are unavailable

**Independent Test**: Stop a NestJS service and verify gateway returns 503 within timeout period

**Success Criteria**: SC-003 (503 within 3.5s)

### Implementation for User Story 3

- [ ] T057 [US3] Create NATS error serializer at `packages/error-handling/src/nats/nats-serializer.ts`
  ```typescript
  // Import AppError from '../errors'
  // 
  // interface SerializedError {
  //   __type: 'AppError';
  //   code: string;
  //   message: string;
  //   httpStatus: number;
  //   details?: unknown;
  //   timestamp: string;
  //   stack?: string;
  // }
  //
  // Export function serializeError(error: AppError): string
  //   - Convert AppError to SerializedError JSON
  //   - Include stack only if NODE_ENV !== 'production'
  //
  // Export function deserializeError(data: string): AppError | null
  //   - Parse JSON, check for __type === 'AppError'
  //   - Reconstruct AppError instance
  //   - Return null if not an AppError
  ```

- [ ] T058 [US3] Create NATS request wrapper at `packages/error-handling/src/nats/nats-request.ts`
  ```typescript
  // Import { NatsConnection, headers as natsHeaders } from 'nats'
  // Import { ServiceUnavailableError } from '../errors'
  // Import { deserializeError } from './nats-serializer'
  // Import { logError } from '../logger'
  //
  // const DEFAULT_TIMEOUT = 3000;
  //
  // Export interface NatsRequestOptions {
  //   timeout?: number;
  //   traceId: string;
  //   logger: any;
  // }
  //
  // Export async function createNatsRequest<T>(
  //   nc: NatsConnection,
  //   subject: string,
  //   data: unknown,
  //   options: NatsRequestOptions
  // ): Promise<T> {
  //   const { timeout = DEFAULT_TIMEOUT, traceId, logger } = options;
  //   
  //   try {
  //     const hdrs = natsHeaders();
  //     hdrs.set('X-Trace-Id', traceId);
  //     
  //     const response = await nc.request(subject, JSON.stringify(data), { headers: hdrs, timeout });
  //     const decoded = JSON.parse(new TextDecoder().decode(response.data));
  //     
  //     // Check if response is serialized error
  //     const error = deserializeError(JSON.stringify(decoded));
  //     if (error) throw error;
  //     
  //     return decoded as T;
  //   } catch (error: any) {
  //     if (error.code === 'TIMEOUT') {
  //       logError(logger, { message: 'NATS timeout', subject, timeout }, { traceId });
  //       throw new ServiceUnavailableError('Service temporarily unavailable');
  //     }
  //     if (error.code === 'NO_RESPONDERS') {
  //       logError(logger, { message: 'NATS no responders', subject }, { traceId });
  //       throw new ServiceUnavailableError('Service not available');
  //     }
  //     throw error;
  //   }
  // }
  ```

- [ ] T059 [US3] Create NATS barrel export at `packages/error-handling/src/nats/index.ts`
  ```typescript
  export * from './nats-serializer';
  export * from './nats-request';
  ```

- [ ] T060 [US3] Update main index to include NATS exports at `packages/error-handling/src/index.ts`
  ```typescript
  // Add: export * from './nats';
  ```

- [ ] T061 [US3] Rebuild shared package at `packages/error-handling/`
  ```bash
  # Run: pnpm build
  ```

- [ ] T062 [US3] Update api-gateway NATS client to use wrapper at `apps/elysia/api-gateway/src/shared/nats-client.ts`
  ```typescript
  // Import { createNatsRequest, createLogger } from '@ain-rider/error-handling'
  //
  // const logger = createLogger({ serviceName: 'api-gateway' });
  // const NATS_TIMEOUT = parseInt(process.env.NATS_TIMEOUT || '3000', 10);
  //
  // Export async function natsRequest<T>(subject: string, data: unknown, traceId: string): Promise<T> {
  //   return createNatsRequest<T>(nc, subject, data, { timeout: NATS_TIMEOUT, traceId, logger });
  // }
  ```

- [ ] T063 [US3] Update api-gateway auth proxy to use new natsRequest at `apps/elysia/api-gateway/src/modules/auth/service.ts`
  ```typescript
  // Replace direct nc.request calls with natsRequest wrapper
  // Pass traceId from request context
  ```

- [ ] T064 [US3] Update api-gateway trips proxy to use new natsRequest at `apps/elysia/api-gateway/src/modules/trips/service.ts`
  ```typescript
  // Replace direct nc.request calls with natsRequest wrapper
  // Pass traceId from request context
  ```

- [ ] T065 [US3] Update api-gateway admin proxy to use new natsRequest at `apps/elysia/api-gateway/src/modules/admin/service.ts`
  ```typescript
  // Replace direct nc.request calls with natsRequest wrapper
  // Pass traceId from request context
  ```

**Checkpoint**: User Story 3 complete - NATS timeouts return 503 within 3 seconds

---

## Phase 6: User Story 4 - Transport-Agnostic NestJS Errors (Priority: P3)

**Goal**: NestJS GlobalExceptionFilter handles both HTTP and NATS errors uniformly

**Independent Test**: Throw same exception from HTTP endpoint and NATS handler, verify identical error responses

**Success Criteria**: SC-001 (unified schema for NATS replies)

### Implementation for User Story 4

- [ ] T066 [US4] Update GlobalExceptionFilter to handle RPC context at `apps/nest/auth-service/src/shared/filters/global-exception.filter.ts`
  ```typescript
  // Update catch method to detect context type:
  // const contextType = host.getType();
  //
  // if (contextType === 'http') {
  //   // Existing HTTP handling
  // } else if (contextType === 'rpc') {
  //   const ctx = host.switchToRpc();
  //   const traceId = ctx.getContext()?.traceId || 'unknown';
  //   // Return serialized error for NATS reply
  //   return appError.toResponse(traceId);
  // }
  ```

- [ ] T067 [US4] Create NATS error handler for auth-service at `apps/nest/auth-service/src/shared/nats/nats-error.handler.ts`
  ```typescript
  // Import { serializeError } from '@ain-rider/error-handling'
  //
  // Export function handleNatsError(error: AppError, traceId: string): string {
  //   return JSON.stringify(error.toResponse(traceId));
  // }
  ```

- [ ] T068 [US4] Update TraceInterceptor to handle RPC context at `apps/nest/auth-service/src/shared/interceptors/trace.interceptor.ts`
  ```typescript
  // Update intercept method to detect context type:
  // const contextType = context.getType();
  //
  // if (contextType === 'http') {
  //   // Existing HTTP handling
  // } else if (contextType === 'rpc') {
  //   const ctx = context.switchToRpc().getContext();
  //   const headers = ctx.getHeaders?.();
  //   ctx.traceId = headers?.get('X-Trace-Id') || generateTraceId();
  // }
  ```

- [ ] T069 [US4] Copy updated GlobalExceptionFilter to trip-service at `apps/nest/trip-service/src/shared/filters/global-exception.filter.ts`

- [ ] T070 [US4] Copy updated TraceInterceptor to trip-service at `apps/nest/trip-service/src/shared/interceptors/trace.interceptor.ts`

- [ ] T071 [US4] Copy NATS error handler to trip-service at `apps/nest/trip-service/src/shared/nats/nats-error.handler.ts`

- [ ] T072 [US4] Copy updated GlobalExceptionFilter to payment-service at `apps/nest/payment-service/src/shared/filters/global-exception.filter.ts`

- [ ] T073 [US4] Copy updated TraceInterceptor to payment-service at `apps/nest/payment-service/src/shared/interceptors/trace.interceptor.ts`

- [ ] T074 [US4] Copy NATS error handler to payment-service at `apps/nest/payment-service/src/shared/nats/nats-error.handler.ts`

- [ ] T075 [US4] Copy updated GlobalExceptionFilter to admin-service at `apps/nest/admin-service/src/shared/filters/global-exception.filter.ts`

- [ ] T076 [US4] Copy updated TraceInterceptor to admin-service at `apps/nest/admin-service/src/shared/interceptors/trace.interceptor.ts`

- [ ] T077 [US4] Copy NATS error handler to admin-service at `apps/nest/admin-service/src/shared/nats/nats-error.handler.ts`

**Checkpoint**: User Story 4 complete - NestJS services handle HTTP and NATS errors uniformly

---

## Phase 7: Polish & Verification

**Purpose**: Final verification and documentation

- [ ] T078 [P] Verify all services start without errors
  ```bash
  # Start each service and check for TypeScript/runtime errors
  ```

- [ ] T079 [P] Test unified error response from api-gateway
  ```bash
  # curl -X POST http://localhost:3000/auth/login -d '{"email":"invalid"}'
  # Verify response matches: { success: false, error: { code, message, traceId } }
  ```

- [ ] T080 [P] Test NATS timeout handling
  ```bash
  # Stop trip-service, then:
  # curl http://localhost:3000/trips
  # Verify 503 response within 3.5 seconds
  ```

- [ ] T081 [P] Test trace correlation across services
  ```bash
  # curl -H "X-Trace-Id: test-trace-123" http://localhost:3000/trips
  # Grep logs for "test-trace-123" in all services
  ```

- [ ] T082 [P] Verify no stack traces in production mode
  ```bash
  # Set NODE_ENV=production, trigger error, verify no stack in response
  ```

- [ ] T083 Update quickstart.md with any implementation changes at `specs/001-error-handling-layer/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 - MVP milestone
- **Phase 4 (US2)**: Depends on Phase 2 - can run parallel with US1
- **Phase 5 (US3)**: Depends on Phase 2 - can run parallel with US1/US2
- **Phase 6 (US4)**: Depends on Phase 3 (needs GlobalExceptionFilter pattern)
- **Phase 7 (Polish)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Foundation only - no dependencies on other stories
- **US2 (P2)**: Foundation only - can run parallel with US1
- **US3 (P2)**: Foundation only - can run parallel with US1/US2
- **US4 (P3)**: Depends on US1 (extends GlobalExceptionFilter)

### Parallel Opportunities

```text
Phase 2 parallel tasks: T007, T010-T017 (all error classes)
Phase 3 parallel tasks: T036-T044 (NestJS service copies)
Phase 4 parallel tasks: T045-T056 (Elysia service integrations)
Phase 7 parallel tasks: T078-T082 (all verification tasks)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test unified error responses
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test → Deploy (MVP!)
3. Add US2 → Test → Deploy (logging)
4. Add US3 → Test → Deploy (timeouts)
5. Add US4 → Test → Deploy (transport-agnostic)

---

## Notes

- **[P]** tasks can run in parallel (different files, no dependencies)
- **[USx]** label maps task to specific user story
- Each task includes inline code hints for a cheaper LLM to implement without additional context
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
- Total tasks: 83
