/**
 * Error normalization and HTTP exception mapping utilities.
 */

import { AppError, InternalError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, BusinessRuleError } from '../errors/index.js';

/**
 * Normalizes any error to an AppError instance.
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, { originalError: error.constructor.name });
  }

  return new InternalError('An unexpected error occurred');
}

/**
 * Maps NestJS HttpException status codes to appropriate AppError.
 */
export function mapHttpExceptionToAppError(exception: { getStatus: () => number; message: string; getResponse?: () => unknown }): AppError {
  const status = exception.getStatus();
  const message = exception.message;
  const response = exception.getResponse?.();

  switch (status) {
    case 400:
      return new ValidationError(message, response);
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 409:
      return new ConflictError(message, response);
    case 422:
      return new BusinessRuleError(message, response);
    default:
      return new InternalError(message, response);
  }
}

/**
 * HTTP status code mapping for error codes.
 */
export const HttpStatusToErrorCode: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'BUSINESS_RULE_VIOLATION',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};
