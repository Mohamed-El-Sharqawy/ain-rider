/**
 * Global error handler for Elysia API Gateway.
 * Normalizes all errors to AppError and returns unified error response.
 */

import { Elysia } from 'elysia';
import { AppError, normalizeError, logError, createLogger, ValidationError, NotFoundError } from '@ain-rider/error-handling';

const logger = createLogger({ serviceName: 'api-gateway' });

/**
 * Error handler plugin for Elysia.
 * Catches all errors and returns unified error response format.
 */
export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, set, store }) => {
    const traceId = (store as any).traceId || 'unknown';
    
    let appError: AppError;
    
    // Handle 404 NOT_FOUND
    if (code === 'NOT_FOUND') {
      appError = new NotFoundError('Resource not found');
    }
    // Handle Elysia validation errors (code is 'VALIDATION')
    else if (code === 'VALIDATION') {
      const validationError = error as any;
      appError = new ValidationError(
        validationError.summary || 'Validation failed',
        { 
          errors: validationError.errors,
          type: validationError.type 
        }
      );
    }
    else {
      appError = normalizeError(error);
    }
    
    logError(logger, appError, { traceId });
    
    set.status = appError.httpStatus;
    return appError.toResponse(traceId);
  });
