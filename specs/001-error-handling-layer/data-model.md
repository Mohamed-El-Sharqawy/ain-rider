# Data Model: Error Handling Layer

**Feature**: 001-error-handling-layer  
**Date**: 2026-03-24

## Overview

This document defines the TypeBox schemas and TypeScript types for the unified error handling system. All schemas are designed to work in both Bun and Node.js runtimes.

## Core Schemas

### ErrorResponse

The unified error response structure returned to all clients.

```typescript
import { Type, Static } from '@sinclair/typebox';

export const ErrorResponseSchema = Type.Object({
  success: Type.Literal(false),
  error: Type.Object({
    code: Type.String({ description: 'Machine-readable error code (uppercase)' }),
    message: Type.String({ description: 'Human-readable error message' }),
    traceId: Type.String({ format: 'uuid', description: 'Request correlation ID' }),
  }),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;
```

**Validation Rules:**
- `success` MUST be `false` for error responses
- `code` MUST be uppercase with underscores (e.g., `VALIDATION_ERROR`)
- `message` MUST NOT contain sensitive data or stack traces
- `traceId` MUST be a valid UUID v4

### SuccessResponse

The unified success response structure (for completeness).

```typescript
export const SuccessResponseSchema = <T extends TSchema>(dataSchema: T) =>
  Type.Object({
    success: Type.Literal(true),
    data: dataSchema,
  });

export type SuccessResponse<T> = {
  success: true;
  data: T;
};
```

### ErrorCode

Enumeration of all standard error codes.

```typescript
export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_GATEWAY: 'BAD_GATEWAY',
  
  // NATS-specific
  NATS_TIMEOUT: 'NATS_TIMEOUT',
  NATS_NO_RESPONDERS: 'NATS_NO_RESPONDERS',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorCodeSchema = Type.Union([
  Type.Literal(ErrorCodes.VALIDATION_ERROR),
  Type.Literal(ErrorCodes.UNAUTHORIZED),
  Type.Literal(ErrorCodes.FORBIDDEN),
  Type.Literal(ErrorCodes.NOT_FOUND),
  Type.Literal(ErrorCodes.CONFLICT),
  Type.Literal(ErrorCodes.BUSINESS_RULE_VIOLATION),
  Type.Literal(ErrorCodes.INTERNAL_ERROR),
  Type.Literal(ErrorCodes.SERVICE_UNAVAILABLE),
  Type.Literal(ErrorCodes.BAD_GATEWAY),
  Type.Literal(ErrorCodes.NATS_TIMEOUT),
  Type.Literal(ErrorCodes.NATS_NO_RESPONDERS),
]);
```

### HTTP Status Mapping

```typescript
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE_VIOLATION: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  BAD_GATEWAY: 502,
  NATS_TIMEOUT: 503,
  NATS_NO_RESPONDERS: 503,
};
```

## Error Classes

### AppError (Base Class)

```typescript
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = ErrorCodeToHttpStatus[code];
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace?.(this, this.constructor);
  }

  toResponse(traceId: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        traceId,
      },
    };
  }
}
```

### Specialized Error Classes

```typescript
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCodes.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;
    super(ErrorCodes.NOT_FOUND, message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(ErrorCodes.UNAUTHORIZED, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(ErrorCodes.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCodes.CONFLICT, message, details);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCodes.BUSINESS_RULE_VIOLATION, message, details);
    this.name = 'BusinessRuleError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(ErrorCodes.SERVICE_UNAVAILABLE, message);
    this.name = 'ServiceUnavailableError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(ErrorCodes.INTERNAL_ERROR, message);
    this.name = 'InternalError';
  }
}
```

## Trace Context

### TraceContext Schema

```typescript
export const TraceContextSchema = Type.Object({
  traceId: Type.String({ format: 'uuid' }),
  serviceName: Type.String(),
  timestamp: Type.String({ format: 'date-time' }),
  parentSpanId: Type.Optional(Type.String()),
});

export type TraceContext = Static<typeof TraceContextSchema>;
```

## Log Entry

### LogEntry Schema

```typescript
export const LogEntrySchema = Type.Object({
  level: Type.Union([
    Type.Literal('trace'),
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error'),
    Type.Literal('fatal'),
  ]),
  serviceName: Type.String(),
  traceId: Type.Optional(Type.String({ format: 'uuid' })),
  errorType: Type.Optional(Type.String()),
  message: Type.String(),
  timestamp: Type.String({ format: 'date-time' }),
  stack: Type.Optional(Type.String()),
  context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type LogEntry = Static<typeof LogEntrySchema>;
```

## NATS Serialization

### SerializedError Schema

Used for transmitting AppError instances over NATS.

```typescript
export const SerializedErrorSchema = Type.Object({
  __type: Type.Literal('AppError'),
  code: ErrorCodeSchema,
  message: Type.String(),
  httpStatus: Type.Number(),
  details: Type.Optional(Type.Unknown()),
  timestamp: Type.String({ format: 'date-time' }),
  stack: Type.Optional(Type.String()),
});

export type SerializedError = Static<typeof SerializedErrorSchema>;
```

## Sanitization Config

### SanitizationConfig Schema

```typescript
export const SanitizationConfigSchema = Type.Object({
  patterns: Type.Array(Type.String({ description: 'Regex patterns for sensitive fields' })),
  replacement: Type.String({ default: '[REDACTED]' }),
  enabled: Type.Boolean({ default: true }),
});

export type SanitizationConfig = Static<typeof SanitizationConfigSchema>;

export const DEFAULT_SANITIZATION_CONFIG: SanitizationConfig = {
  patterns: [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'credential',
    'apikey',
    'api_key',
    'bearer',
  ],
  replacement: '[REDACTED]',
  enabled: true,
};
```

## Entity Relationships

```
┌─────────────────┐
│   AppError      │
│  (base class)   │
└────────┬────────┘
         │ extends
    ┌────┴────┬────────────┬────────────┬────────────┐
    │         │            │            │            │
┌───▼───┐ ┌───▼───┐  ┌─────▼─────┐ ┌────▼────┐ ┌────▼────┐
│Validat│ │NotFou │  │Unauthoriz │ │Conflict │ │Business │
│ionErr │ │ndErr  │  │edError    │ │Error    │ │RuleErr  │
└───────┘ └───────┘  └───────────┘ └─────────┘ └─────────┘

┌─────────────────┐     serializes     ┌─────────────────┐
│   AppError      │ ─────────────────► │ SerializedError │
│  (instance)     │                    │   (NATS wire)   │
└─────────────────┘ ◄───────────────── └─────────────────┘
                      deserializes

┌─────────────────┐     produces       ┌─────────────────┐
│   AppError      │ ─────────────────► │  ErrorResponse  │
│  .toResponse()  │                    │   (HTTP body)   │
└─────────────────┘                    └─────────────────┘

┌─────────────────┐     enriches       ┌─────────────────┐
│  TraceContext   │ ─────────────────► │    LogEntry     │
│   (request)     │                    │   (stdout)      │
└─────────────────┘                    └─────────────────┘
```

## Validation Rules Summary

| Entity | Field | Rule |
|--------|-------|------|
| ErrorResponse | code | Uppercase, underscores only |
| ErrorResponse | message | No sensitive data, no stack traces |
| ErrorResponse | traceId | Valid UUID v4 |
| AppError | httpStatus | 400-599 range |
| LogEntry | level | One of: trace, debug, info, warn, error, fatal |
| LogEntry | timestamp | ISO 8601 format |
| SerializedError | __type | Must be 'AppError' literal |
