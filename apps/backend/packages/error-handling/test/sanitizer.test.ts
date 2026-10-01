import { describe, expect, test } from 'vitest';
import { sanitize, sanitizeString } from '../src';

describe('sanitize', () => {
  test('passes through null, undefined and primitives', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
    expect(sanitize(42)).toBe(42);
    expect(sanitize('plain')).toBe('plain');
    expect(sanitize(true)).toBe(true);
  });

  test('redacts values under sensitive keys', () => {
    const input = {
      username: 'rider1',
      password: 'hunter2',
      apiToken: 'abc',
      clientSecret: 's',
      apiKey: 'k',
      authorization: 'Bearer x',
      credentials: 'c',
      Bearer: 'b',
    };

    const result = sanitize(input) as Record<string, string>;
    expect(result.username).toBe('rider1');
    for (const key of ['password', 'apiToken', 'clientSecret', 'apiKey', 'authorization', 'credentials', 'Bearer']) {
      expect(result[key]).toBe('[REDACTED]');
    }
  });

  test('sanitizes nested objects and arrays', () => {
    const input = {
      user: { name: 'amr', password: 'hunter2' },
      trips: [{ id: 1, refreshToken: 't' }, { id: 2, ok: true }],
    };

    expect(sanitize(input)).toEqual({
      user: { name: 'amr', password: '[REDACTED]' },
      trips: [{ id: 1, refreshToken: '[REDACTED]' }, { id: 2, ok: true }],
    });
  });

  test('preserves Date values instead of flattening them to {}', () => {
    const createdAt = new Date('2026-01-02T03:04:05.678Z');
    const result = sanitize({ createdAt, name: 'trip' }) as { createdAt: unknown };

    expect(result.createdAt instanceof Date).toBe(true);
    expect((result.createdAt as Date).toISOString()).toBe('2026-01-02T03:04:05.678Z');
  });

  test('returns empty object for empty input object', () => {
    expect(sanitize({})).toEqual({});
  });
});

describe('sanitizeString', () => {
  test('redacts key=value and key: value pairs', () => {
    expect(sanitizeString('password=hunter2')).toBe('password: [REDACTED]');
    expect(sanitizeString('token: abc123')).toBe('token: [REDACTED]');
    expect(sanitizeString('secret=topsecret')).toBe('secret: [REDACTED]');
    expect(sanitizeString('api_key=k')).toBe('api_key: [REDACTED]');
    expect(sanitizeString('apiKey=k')).toBe('apiKey: [REDACTED]');
    expect(sanitizeString('api-key=k')).toBe('api-key: [REDACTED]');
    expect(sanitizeString('authorization=Basic abc')).toBe('authorization: [REDACTED]');
  });

  test('redacts bearer tokens without a delimiter', () => {
    expect(sanitizeString('bearer abc.def.ghi')).toBe('[REDACTED]');
    expect(sanitizeString('Authorization: Bearer xyz')).toBe('Authorization: [REDACTED]');
  });

  test('leaves strings without sensitive patterns untouched', () => {
    expect(sanitizeString('trip created for user 42')).toBe('trip created for user 42');
  });

  test('redacts every occurrence in a longer message', () => {
    const result = sanitizeString('login with password=hunter2 then token=abc failed');
    expect(result).toContain('password: [REDACTED]');
    expect(result).toContain('token: [REDACTED]');
    expect(result).toContain(' failed');
    expect(result).not.toContain('hunter2');
    expect(result).not.toContain('abc');
  });
});
