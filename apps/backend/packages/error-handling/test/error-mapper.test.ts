import { describe, expect, test } from 'vitest';
import {
  HttpStatusToErrorCode,
  normalizeError,
  mapHttpExceptionToAppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  UnsupportedMediaTypeError,
  TooManyRequestsError,
  ServiceUnavailableError,
  InternalError,
} from '../src';

describe('normalizeError', () => {
  test('returns AppError instances unchanged', () => {
    const original = new NotFoundError('Trip', 't-1');

    expect(normalizeError(original)).toBe(original);
  });

  test('wraps plain Errors into InternalError carrying the original type', () => {
    const original = new RangeError('out of range');

    const normalized = normalizeError(original);

    expect(normalized).toBeInstanceOf(InternalError);
    expect(normalized.code).toBe('INTERNAL_ERROR');
    expect(normalized.httpStatus).toBe(500);
    expect(normalized.message).toBe('out of range');
    expect(normalized.details).toEqual({ originalError: 'RangeError' });
  });

  test('wraps non-Error values into a generic InternalError', () => {
    const normalized = normalizeError('totally unexpected');

    expect(normalized).toBeInstanceOf(InternalError);
    expect(normalized.message).toBe('An unexpected error occurred');
    expect(normalized.details).toBeUndefined();
  });
});

describe('mapHttpExceptionToAppError', () => {
  test.each([
    [400, ValidationError, 'VALIDATION_ERROR'],
    [401, UnauthorizedError, 'UNAUTHORIZED'],
    [403, ForbiddenError, 'FORBIDDEN'],
    [404, NotFoundError, 'NOT_FOUND'],
    [409, ConflictError, 'CONFLICT'],
    [422, BusinessRuleError, 'BUSINESS_RULE_VIOLATION'],
    [415, UnsupportedMediaTypeError, 'UNSUPPORTED_MEDIA_TYPE'],
    [429, TooManyRequestsError, 'TOO_MANY_REQUESTS'],
    [500, InternalError, 'INTERNAL_ERROR'],
    [503, ServiceUnavailableError, 'SERVICE_UNAVAILABLE'],
  ])('maps status %i to %s', (status, klass, code) => {
    const mapped = mapHttpExceptionToAppError({
      getStatus: () => status,
      message: 'http failure',
      getResponse: () => ({ extra: 'info' }),
    });

    expect(mapped).toBeInstanceOf(klass);
    expect(mapped.code).toBe(code);
    expect(mapped.message).toBe('http failure');
  });

  test('uses the exception response as details when present', () => {
    const response = { message: 'Validation failed', items: ['phone is required'] };
    const mapped = mapHttpExceptionToAppError({
      getStatus: () => 400,
      message: 'Validation failed',
      getResponse: () => response,
    });

    expect(mapped.details).toBe(response);
  });

  test('works when getResponse is not implemented', () => {
    const mapped = mapHttpExceptionToAppError({
      getStatus: () => 418,
      message: 'teapot',
    });

    expect(mapped).toBeInstanceOf(InternalError);
    expect(mapped.details).toBeUndefined();
  });

  test('does not append a second "not found" suffix for 404s', () => {
    const mapped = mapHttpExceptionToAppError({
      getStatus: () => 404,
      message: 'Trip with ID 7 not found',
      getResponse: () => undefined,
    });

    expect(mapped.message).toBe('Trip with ID 7 not found');
  });
});

describe('HttpStatusToErrorCode', () => {
  test('maps the documented statuses', () => {
    expect(HttpStatusToErrorCode).toEqual({
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'BUSINESS_RULE_VIOLATION',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    });
  });
});
