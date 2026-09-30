# Research: Error Handling Layer

**Feature**: 001-error-handling-layer  
**Date**: 2026-03-24

## Research Topics

### 1. TypeBox for Cross-Runtime Schema Validation

**Decision**: Use TypeBox for all error schema definitions

**Rationale**:
- Works in both Bun and Node.js runtimes without modification
- Provides TypeScript type inference from schema definitions
- Smaller bundle size than Zod (~5KB vs ~50KB)
- JSON Schema compatible (useful for documentation)
- Already used in Elysia ecosystem

**Alternatives Considered**:
- **Zod**: Excellent DX but larger bundle, slightly slower runtime validation
- **class-validator/class-transformer**: Node.js only, doesn't work in Bun runtime
- **io-ts**: Functional approach, steeper learning curve

**Migration Note**: NestJS services currently use class-validator. Migration path:
1. Add TypeBox as dependency alongside class-validator
2. Create TypeBox schemas in shared package
3. Gradually replace class-validator DTOs with TypeBox in new code
4. Existing DTOs can coexist during transition

### 2. Pino for Structured Logging

**Decision**: Use Pino as the standardized logging library

**Rationale**:
- 5-10x faster than Winston in benchmarks
- Native JSON output (no serialization overhead)
- Works in both Bun and Node.js
- Built-in support for child loggers (perfect for traceId injection)
- Minimal configuration required

**Alternatives Considered**:
- **Winston**: More features but significantly slower, larger footprint
- **Bunyan**: Similar to Pino but less maintained
- **console.log**: No structure, no log levels, not production-ready

**Configuration**:
```typescript
// Base configuration for all services
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    serviceName: process.env.SERVICE_NAME,
  },
});
```

### 3. NATS Error Serialization Strategy

**Decision**: Use JSON envelope with type discriminator for AppError serialization

**Rationale**:
- NATS messages are binary (Uint8Array), requiring serialization
- Standard JSON.stringify loses class type information
- Need to reconstruct AppError instances on the receiving side
- Type discriminator pattern enables proper error class instantiation

**Implementation Pattern**:
```typescript
// Serialization (sender side)
interface SerializedError {
  __type: 'AppError';
  code: string;
  message: string;
  httpStatus: number;
  details?: unknown;
  stack?: string;
}

function serializeError(error: AppError): string {
  return JSON.stringify({
    __type: 'AppError',
    code: error.code,
    message: error.message,
    httpStatus: error.httpStatus,
    details: error.details,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
  });
}

// Deserialization (receiver side)
function deserializeError(data: string): AppError | null {
  const parsed = JSON.parse(data);
  if (parsed.__type === 'AppError') {
    return new AppError(parsed.code, parsed.message, parsed.httpStatus, parsed.details);
  }
  return null;
}
```

**Alternatives Considered**:
- **Protocol Buffers**: Overkill for error objects, adds complexity
- **MessagePack**: Faster but loses readability for debugging
- **Plain JSON**: Loses type information, can't reconstruct error classes

### 4. TraceId Generation and Propagation

**Decision**: Use UUID v4 for traceId, propagate via HTTP header and NATS headers

**Rationale**:
- UUID v4 provides sufficient uniqueness for distributed tracing
- `X-Trace-Id` header is a common convention
- NATS supports message headers since v2.2
- Consistent propagation enables end-to-end request correlation

**Implementation Pattern**:
```typescript
// Gateway: Extract or generate traceId
function getTraceId(request: Request): string {
  return request.headers.get('X-Trace-Id') || crypto.randomUUID();
}

// Gateway: Propagate to NATS
async function natsRequest(subject: string, data: unknown, traceId: string) {
  const headers = headers();
  headers.set('X-Trace-Id', traceId);
  return nc.request(subject, encode(data), { headers, timeout: 3000 });
}

// NestJS: Extract from NATS headers
function extractTraceId(context: NatsContext): string {
  return context.getHeaders()?.get('X-Trace-Id') || crypto.randomUUID();
}
```

**Alternatives Considered**:
- **OpenTelemetry trace context**: More complex, requires full OTel setup
- **Custom correlation ID**: Same concept, different naming
- **Request ID only**: Doesn't span service boundaries

### 5. Sensitive Data Sanitization

**Decision**: Automatic regex-based sanitization with predefined patterns

**Rationale**:
- Prevents accidental exposure of credentials in logs
- Centralized configuration ensures consistency
- Regex patterns are fast and maintainable
- Default patterns cover common sensitive fields

**Implementation Pattern**:
```typescript
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /credential/i,
  /apikey/i,
  /api_key/i,
  /bearer/i,
];

function sanitize(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj; // Don't modify string values directly
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitize(value);
      }
    }
    return result;
  }
  return obj;
}
```

**Alternatives Considered**:
- **Opt-in sanitization**: Risk of forgetting to sanitize
- **Field-level decorators**: Requires modifying every DTO
- **No sanitization**: Security risk

### 6. NATS Timeout and No Responder Handling

**Decision**: 3000ms default timeout, immediate 503 for NO_RESPONDERS

**Rationale**:
- 3 seconds balances responsiveness with allowing slow operations
- NO_RESPONDERS indicates service is down, no point waiting
- Both map to HTTP 503 Service Unavailable
- Configurable per-request for special cases

**Implementation Pattern**:
```typescript
const DEFAULT_TIMEOUT = 3000;

async function natsRequest<T>(
  subject: string,
  data: unknown,
  options: { timeout?: number; traceId: string }
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, traceId } = options;
  
  try {
    const headers = natsHeaders();
    headers.set('X-Trace-Id', traceId);
    
    const response = await nc.request(subject, encode(data), { headers, timeout });
    const decoded = decode(response.data);
    
    // Check if response is a serialized error
    if (decoded.__type === 'AppError') {
      throw deserializeError(decoded);
    }
    
    return decoded as T;
  } catch (error) {
    if (error.code === 'TIMEOUT') {
      logger.error({ subject, timeout, traceId, errorType: 'NATS_TIMEOUT' }, 'NATS request timed out');
      throw new ServiceUnavailableError('Service temporarily unavailable');
    }
    if (error.code === 'NO_RESPONDERS') {
      logger.error({ subject, traceId, errorType: 'NATS_NO_RESPONDERS' }, 'No service responders');
      throw new ServiceUnavailableError('Service not available');
    }
    throw error;
  }
}
```

## Summary of Decisions

| Topic | Decision | Key Benefit |
|-------|----------|-------------|
| Schema Validation | TypeBox | Cross-runtime compatibility |
| Logging | Pino | Performance + native JSON |
| NATS Serialization | JSON with type discriminator | Preserves error class info |
| TraceId Format | UUID v4 | Uniqueness + simplicity |
| TraceId Propagation | HTTP + NATS headers | End-to-end correlation |
| Sanitization | Automatic regex patterns | Security by default |
| NATS Timeout | 3000ms default | Bounded response time |
