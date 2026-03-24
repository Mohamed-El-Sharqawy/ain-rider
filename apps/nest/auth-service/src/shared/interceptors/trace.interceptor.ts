/**
 * Trace interceptor for NestJS services.
 * Extracts or generates trace ID for request correlation.
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { generateTraceId, extractTraceId } from '@ain-rider/error-handling';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const traceId = extractTraceId(request.headers as Record<string, string>) || generateTraceId();
    (request as any).traceId = traceId;
    return next.handle();
  }
}
