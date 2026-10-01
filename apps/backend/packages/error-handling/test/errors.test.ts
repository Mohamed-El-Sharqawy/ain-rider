import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../src';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AppError', () => {
  test('maps code to http status and stamps an iso timestamp', () => {
    const error = new AppError('VALIDATION_ERROR', 'bad input', { field: 'phone' });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.httpStatus).toBe(400);
    expect(error.message).toBe('bad input');
    expect(error.details).toEqual({ field: 'phone' });
    expect(new Date(error.timestamp).toISOString()).toBe(error.timestamp);
  });

  test('toResponse includes details outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const error = new ValidationError('bad input', ['field is required']);

    expect(error.toResponse('11111111-1111-4111-8111-111111111111')).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bad input',
        traceId: '11111111-1111-4111-8111-111111111111',
        details: ['field is required'],
      },
    });
  });

  test('toResponse omits details when there are none', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const error = new ValidationError('bad input');

    const response = error.toResponse('11111111-1111-4111-8111-111111111111');
    expect(response.error.details).toBeUndefined();
  });

  test('toResponse hides non-validation details in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = new InternalError('boom', { internals: 'secret' });

    const response = error.toResponse('11111111-1111-4111-8111-111111111111');
    expect(response.error.details).toBeUndefined();
  });

  test('toResponse keeps validation details in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = new ValidationError('bad input', { field: 'phone' });

    const response = error.toResponse('11111111-1111-4111-8111-111111111111');
    expect(response.error.details).toEqual({ field: 'phone' });
  });

  test('toJSON exposes stack outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const error = new AppError('NOT_FOUND', 'missing');

    const json = error.toJSON();
    expect(json).toMatchObject({
      __type: 'AppError',
      code: 'NOT_FOUND',
      message: 'missing',
      httpStatus: 404,
      timestamp: error.timestamp,
    });
    expect(typeof json.stack).toBe('string');
  });

  test('toJSON drops the stack in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = new AppError('NOT_FOUND', 'missing', { id: 7 });

    expect(error.toJSON()).toEqual({
      __type: 'AppError',
      code: 'NOT_FOUND',
      message: 'missing',
      httpStatus: 404,
      details: { id: 7 },
      timestamp: error.timestamp,
      stack: undefined,
    });
  });
});

describe('error subclasses', () => {
  test('ValidationError maps to 400', () => {
    const error = new ValidationError('invalid phone');
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.httpStatus).toBe(400);
    expect(error.name).toBe('ValidationError');
  });

  test('UnauthorizedError maps to 401 with default message', () => {
    const error = new UnauthorizedError();
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.httpStatus).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  test('ForbiddenError maps to 403 with default message', () => {
    const error = new ForbiddenError();
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe('Access denied');
  });

  test('NotFoundError formats resource + identifier', () => {
    const error = new NotFoundError('Trip', 'abc-123');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.httpStatus).toBe(404);
    expect(error.message).toBe(`Trip with ID 'abc-123' not found`);
  });

  test('NotFoundError keeps a full message as-is', () => {
    const error = new NotFoundError('Trip no longer active');
    expect(error.message).toBe('Trip no longer active');
  });

  test('ConflictError maps to 409', () => {
    const error = new ConflictError('already exists', { phone: '+20' });
    expect(error.code).toBe('CONFLICT');
    expect(error.httpStatus).toBe(409);
    expect(error.details).toEqual({ phone: '+20' });
  });

  test('BusinessRuleError maps to 422', () => {
    const error = new BusinessRuleError('driver already on a trip');
    expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(error.httpStatus).toBe(422);
  });

  test('InternalError maps to 500 with default message', () => {
    const error = new InternalError();
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.httpStatus).toBe(500);
    expect(error.message).toBe('An unexpected error occurred');
  });

  test('ServiceUnavailableError maps to 503 with default message', () => {
    const error = new ServiceUnavailableError();
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.httpStatus).toBe(503);
    expect(error.message).toBe('Service temporarily unavailable');
  });
});
