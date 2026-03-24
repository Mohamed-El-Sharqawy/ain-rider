# Quickstart: Error Handling Layer Integration

**Feature**: 001-error-handling-layer  
**Date**: 2026-03-24

## Prerequisites

- Node.js 20+ (for NestJS services)
- Bun runtime (for Elysia services)
- NATS server running
- Existing service codebase

## Installation

### 1. Install the shared package

```bash
# From repository root
cd packages/error-handling
pnpm install
pnpm build

# Link to services (if using workspace)
# The package should be available as @ain-rider/error-handling
```

### 2. Add dependency to services

```bash
# For each service
cd apps/elysia/api-gateway
pnpm add @ain-rider/error-handling

cd apps/nest/auth-service
pnpm add @ain-rider/error-handling
```

## Integration Guide

### Elysia Services (API Gateway)

#### Step 1: Configure the logger

```typescript
// src/shared/logger.ts
import { createLogger } from '@ain-rider/error-handling';

export const logger = createLogger({
  serviceName: 'api-gateway',
  level: process.env.LOG_LEVEL || 'info',
});
```

#### Step 2: Add trace middleware

```typescript
// src/shared/trace.ts
import { Elysia } from 'elysia';
import { generateTraceId, extractTraceId } from '@ain-rider/error-handling';

export const traceMiddleware = new Elysia({ name: 'trace' })
  .derive(({ request }) => {
    const traceId = extractTraceId(request.headers) || generateTraceId();
    return { traceId };
  });
```

#### Step 3: Configure global error handler

```typescript
// src/shared/error-handler.ts
import { Elysia } from 'elysia';
import { 
  AppError, 
  InternalError,
  mapErrorToResponse,
  logger 
} from '@ain-rider/error-handling';

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ error, set, traceId }) => {
    // Log the error
    logger.error({
      traceId,
      errorType: error.name,
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });

    // Map to response
    if (error instanceof AppError) {
      set.status = error.httpStatus;
      return error.toResponse(traceId);
    }

    // Unknown error - wrap as InternalError
    const internalError = new InternalError();
    set.status = 500;
    return internalError.toResponse(traceId);
  });
```

#### Step 4: Configure NATS client with timeout

```typescript
// src/shared/nats-client.ts
import { 
  createNatsRequest, 
  ServiceUnavailableError,
  logger 
} from '@ain-rider/error-handling';

const NATS_TIMEOUT = parseInt(process.env.NATS_TIMEOUT || '3000', 10);

export async function natsRequest<T>(
  subject: string,
  data: unknown,
  traceId: string
): Promise<T> {
  return createNatsRequest<T>(nc, subject, data, {
    timeout: NATS_TIMEOUT,
    traceId,
    logger,
  });
}
```

#### Step 5: Register in main app

```typescript
// src/index.ts
import { Elysia } from 'elysia';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';

const app = new Elysia()
  .use(traceMiddleware)
  .use(errorHandler)
  // ... other plugins and routes
  .listen(3000);
```

### NestJS Services

#### Step 1: Configure the logger

```typescript
// src/shared/logger/logger.service.ts
import { Injectable } from '@nestjs/common';
import { createLogger, Logger } from '@ain-rider/error-handling';

@Injectable()
export class LoggerService {
  private logger: Logger;

  constructor() {
    this.logger = createLogger({
      serviceName: process.env.SERVICE_NAME || 'unknown-service',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  error(message: string, context: Record<string, unknown>) {
    this.logger.error(context, message);
  }

  // ... other log methods
}
```

#### Step 2: Create trace interceptor

```typescript
// src/shared/interceptors/trace.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { generateTraceId, extractTraceId } from '@ain-rider/error-handling';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();
    
    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest();
      request.traceId = extractTraceId(request.headers) || generateTraceId();
    } else if (contextType === 'rpc') {
      const ctx = context.switchToRpc().getContext();
      const headers = ctx.getHeaders?.();
      ctx.traceId = headers?.get('X-Trace-Id') || generateTraceId();
    }
    
    return next.handle();
  }
}
```

#### Step 3: Create global exception filter

```typescript
// src/shared/filters/global-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { 
  AppError, 
  InternalError, 
  ValidationError,
  mapHttpExceptionToAppError,
} from '@ain-rider/error-handling';
import { LoggerService } from '../logger/logger.service';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const contextType = host.getType();
    const traceId = this.extractTraceId(host);
    
    // Normalize to AppError
    const appError = this.normalizeException(exception);
    
    // Log the error
    this.logger.error('Request failed', {
      traceId,
      errorType: appError.code,
      message: appError.message,
      stack: process.env.NODE_ENV !== 'production' ? (exception as Error).stack : undefined,
    });

    // Return response based on context type
    if (contextType === 'http') {
      const response = host.switchToHttp().getResponse();
      response.status(appError.httpStatus).json(appError.toResponse(traceId));
    } else if (contextType === 'rpc') {
      // For NATS, return serialized error
      return appError.toResponse(traceId);
    }
  }

  private normalizeException(exception: unknown): AppError {
    if (exception instanceof AppError) {
      return exception;
    }
    if (exception instanceof HttpException) {
      return mapHttpExceptionToAppError(exception);
    }
    return new InternalError();
  }

  private extractTraceId(host: ArgumentsHost): string {
    const contextType = host.getType();
    if (contextType === 'http') {
      return host.switchToHttp().getRequest().traceId || 'unknown';
    }
    if (contextType === 'rpc') {
      return host.switchToRpc().getContext().traceId || 'unknown';
    }
    return 'unknown';
  }
}
```

#### Step 4: Register globally in main.ts

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { TraceInterceptor } from './shared/interceptors/trace.interceptor';
import { LoggerService } from './shared/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const logger = app.get(LoggerService);
  
  app.useGlobalInterceptors(new TraceInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
```

## Verification

### Test 1: Unified Error Response (SC-001)

```bash
# Trigger a validation error
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'

# Expected response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email address is invalid",
    "traceId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Test 2: Structured Logging (SC-002)

```bash
# Check logs after triggering an error
# Expected log entry (JSON):
{
  "level": "error",
  "serviceName": "api-gateway",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "errorType": "VALIDATION_ERROR",
  "message": "Email address is invalid",
  "timestamp": "2026-03-24T12:00:00.000Z"
}
```

### Test 3: NATS Timeout (SC-003)

```bash
# Stop a downstream service and make a request
# Expected: HTTP 503 within 3.5 seconds

curl -w "\nTime: %{time_total}s\n" http://localhost:3000/trips

# Expected response:
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable",
    "traceId": "..."
  }
}
# Time: ~3.0s
```

### Test 4: Trace Correlation (SC-005)

```bash
# Make a request with custom trace ID
curl -X GET http://localhost:3000/trips/123 \
  -H "X-Trace-Id: my-custom-trace-id"

# Check logs in ALL services - should contain same traceId
grep "my-custom-trace-id" /var/log/api-gateway.log
grep "my-custom-trace-id" /var/log/trip-service.log
```

## Troubleshooting

### Error: "Cannot find module '@ain-rider/error-handling'"

Ensure the package is built and linked:

```bash
cd packages/error-handling
pnpm build
```

### Error: "NATS timeout" on every request

Check NATS connectivity:

```bash
# Verify NATS is running
curl http://localhost:8222/healthz

# Check service is subscribed
nats sub "trip.>" --count 1
```

### Logs not appearing in JSON format

Ensure `NODE_ENV` is set and Pino is configured:

```bash
export NODE_ENV=production
export LOG_LEVEL=info
```

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement `packages/error-handling` package first
3. Integrate into API Gateway
4. Roll out to NestJS services one by one
5. Verify all success criteria (SC-001 through SC-006)
