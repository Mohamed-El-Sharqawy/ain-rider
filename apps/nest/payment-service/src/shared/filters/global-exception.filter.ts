/**
 * Global exception filter for NestJS services.
 * Catches all exceptions and returns unified error response format.
 */

import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, normalizeError, logError, createLogger, ErrorCodes, ErrorCodeToHttpStatus } from '@ain-rider/error-handling';

const logger = createLogger({ serviceName: 'payment-service' });

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const traceId = (request as any).traceId || 'unknown';

    let appError: AppError;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      let code = ErrorCodes.INTERNAL_ERROR;
      for (const [errorCode, httpStatus] of Object.entries(ErrorCodeToHttpStatus)) {
        if (httpStatus === status) {
          code = errorCode as any;
          break;
        }
      }
      
      appError = normalizeError(exception);
      (appError as any).code = code;
      (appError as any).httpStatus = status;
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        (appError as any).details = exceptionResponse;
      }
    } else {
      appError = normalizeError(exception);
    }

    logError(logger, appError, { traceId, path: request.url, method: request.method });
    
    response.status(appError.httpStatus).send(appError.toResponse(traceId));
  }
}
