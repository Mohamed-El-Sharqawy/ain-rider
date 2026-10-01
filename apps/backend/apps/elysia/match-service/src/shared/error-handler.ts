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
  .onError({ as: 'global' }, ({ error, set, store }) => {
    /* v8 ignore next -- traceMiddleware (as: 'scoped') always sets traceId first */
    const traceId = (store as any).traceId || 'unknown';

    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (isElysiaValidationError(error)) {
      appError = new ValidationError(
        'Validation failed',
        { validation: summarizeElysiaValidation(error) }
      );
    } else {
      appError = normalizeError(error);
    }

    logError(logger, appError, { traceId });

    set.status = appError.httpStatus;
    return appError.toResponse(traceId);
  });

/**
 * Elysia 1.4 flags validation failures with code VALIDATION (older
 * releases used type === 'validation').
 */
function isElysiaValidationError(error: unknown): boolean {
  return (
    /* v8 ignore next 2 -- Elysia always flags with code VALIDATION; type is legacy */
    error instanceof Error &&
    ((error as any).code === 'VALIDATION' || (error as any).type === 'validation')
  );
}

/**
 * Elysia serializes the validation problem as JSON in the message.
 */
function summarizeElysiaValidation(error: any): unknown {
  /* v8 ignore next 3 -- Elysia validation messages are always JSON or plain strings */
  const raw = typeof error?.message === 'string' ? error.message : '';
  const parsed = raw.trimStart().startsWith('{') ? JSON.parse(raw) : { summary: raw };
  return parsed.summary ?? parsed;
}