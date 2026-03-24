/**
 * Global exception filter for NestJS services.
 * Catches all exceptions and returns unified error response format.
 * Handles both HTTP and RPC (NATS) contexts.
 */

import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, normalizeError, logError, createLogger, mapHttpExceptionToAppError } from '@ain-rider/error-handling';

const logger = createLogger({ serviceName: 'payment-service' });

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const contextType = host.getType();
    
    let appError: AppError;

    if (exception instanceof HttpException) {
      appError = mapHttpExceptionToAppError({
        getStatus: () => exception.getStatus(),
        message: exception.message,
        getResponse: () => exception.getResponse(),
      });
    } else {
      appError = normalizeError(exception);
    }

    // Handle HTTP context
    if (contextType === 'http') {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<FastifyReply>();
      const request = ctx.getRequest<FastifyRequest>();
      const traceId = (request as any).traceId || 'unknown';

      logError(logger, appError, { traceId, path: request.url, method: request.method });
      
      response.status(appError.httpStatus).send(appError.toResponse(traceId));
    }

    // Handle RPC (NATS) context
    if (contextType === 'rpc') {
      const ctx = host.switchToRpc();
      const traceId = (ctx.getContext() as any)?.traceId || 'unknown';
      
      logError(logger, appError, { traceId, context: 'rpc' });
      
      // Return serialized error for NATS reply
      return appError.toResponse(traceId);
    }

    // Fallback for unknown context types
    logError(logger, appError, { traceId: 'unknown', context: 'unknown' });
    return appError.toResponse('unknown');
  }
}
