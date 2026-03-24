/**
 * Trace interceptor for NestJS services.
 * Extracts or generates trace ID for request correlation.
 * Handles both HTTP and RPC (NATS) contexts.
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { generateTraceId, extractTraceId } from '@ain-rider/error-handling';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType();

    // Handle HTTP context
    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest<FastifyRequest>();
      const traceId = extractTraceId(request.headers as Record<string, string>) || generateTraceId();
      (request as any).traceId = traceId;
      return next.handle();
    }

    // Handle RPC (NATS) context
    if (contextType === 'rpc') {
      const ctx = context.switchToRpc();
      const contextObj = ctx.getContext() as any;
      
      // Extract traceId from NATS headers or generate new one
      const headers = contextObj?.getHeaders?.();
      const traceId = headers?.get?.('X-Trace-Id') || contextObj?.traceId || generateTraceId();
      
      // Attach traceId to context for use in exception filter
      if (contextObj) {
        contextObj.traceId = traceId;
      }
      
      return next.handle();
    }

    return next.handle();
  }
}
