/**
 * Global error handler for Elysia Match Service.
 * Normalizes all errors to AppError and returns unified error response.
 */

import { Elysia } from 'elysia';
import { AppError, normalizeError, logError, createLogger, ValidationError } from '@ain-rider/error-handling';

const logger = createLogger({ serviceName: 'match-service' });

/**
 * Error handler plugin for Elysia.
 * Catches all errors and returns unified error response format.
 */
export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ error, set, store }) => {
    const traceId = (store as any).traceId || 'unknown';
    
    let appError: AppError;
    
    // Handle Elysia validation errors
    if (error && typeof error === 'object' && 'type' in error && (error as any).type === 'validation') {
      appError = new ValidationError(
        'Validation failed',
        { validation: (error as any).summary || error.message }
      );
    } else {
      appError = normalizeError(error);
    }
    
    logError(logger, appError, { traceId });
    
    set.status = appError.httpStatus;
    return appError.toResponse(traceId);
  });
