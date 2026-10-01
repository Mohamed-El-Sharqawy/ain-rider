import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppError, deserializeError, isSerializedError, serializeError } from '../src';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('serializeError', () => {
  test('serializes code, message, status, details and timestamp', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const error = new AppError('CONFLICT', 'already exists', { phone: '+20100' });

    const parsed = JSON.parse(serializeError(error));
    expect(parsed).toEqual({
      __type: 'AppError',
      code: 'CONFLICT',
      message: 'already exists',
      httpStatus: 409,
      details: { phone: '+20100' },
      timestamp: error.timestamp,
      stack: error.stack,
    });
  });

  test('omits details when the error has none', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const error = new AppError('NOT_FOUND', 'missing');

    const parsed = JSON.parse(serializeError(error));
    expect('details' in parsed).toBe(false);
  });

  test('omits the stack in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = new AppError('NOT_FOUND', 'missing');

    const parsed = JSON.parse(serializeError(error));
    expect(parsed.stack).toBeUndefined();
    expect(parsed.code).toBe('NOT_FOUND');
  });
});

describe('deserializeError', () => {
  test('round-trips an AppError with code, httpStatus, timestamp and stack', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const original = new AppError('BUSINESS_RULE_VIOLATION', 'driver already on a trip', { tripId: 7 });
    const restored = deserializeError(serializeError(original));

    expect(restored).toBeInstanceOf(AppError);
    expect(restored!.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(restored!.message).toBe('driver already on a trip');
    expect(restored!.httpStatus).toBe(422);
    expect(restored!.details).toEqual({ tripId: 7 });
    expect(restored!.timestamp).toBe(original.timestamp);
    expect(restored!.stack).toBe(original.stack);
  });

  test('restores an error serialized without a stack (production origin)', () => {
    const payload = JSON.stringify({
      __type: 'AppError',
      code: 'UNAUTHORIZED',
      message: 'token expired',
      httpStatus: 401,
      timestamp: '2026-01-02T03:04:05.000Z',
    });

    const restored = deserializeError(payload);

    expect(restored!.code).toBe('UNAUTHORIZED');
    expect(restored!.stack).not.toBe(payload);
  });

  test('returns null for payloads that are not serialized AppErrors', () => {
    expect(deserializeError(JSON.stringify({ hello: 'world' }))).toBeNull();
    expect(deserializeError(JSON.stringify({ __type: 'OtherError' }))).toBeNull();
    expect(deserializeError('not json at all')).toBeNull();
  });
});

describe('isSerializedError', () => {
  test('accepts objects carrying the AppError marker', () => {
    expect(isSerializedError({ __type: 'AppError', code: 'NOT_FOUND' })).toBe(true);
  });

  test('rejects null, primitives and other shapes', () => {
    expect(isSerializedError(null)).toBe(false);
    expect(isSerializedError('AppError')).toBe(false);
    expect(isSerializedError({ code: 'NOT_FOUND' })).toBe(false);
  });
});
