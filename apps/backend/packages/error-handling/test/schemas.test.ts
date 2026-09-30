import { FormatRegistry, Kind } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, test } from 'vitest';
import {
  ErrorCodeToHttpStatus,
  ErrorCodes,
  ErrorDetailSchema,
  ErrorResponseSchema,
  TraceContextSchema,
} from '../src';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
FormatRegistry.Set('uuid', (value) => UUID_RE.test(value));
FormatRegistry.Set('date-time', (value) => !Number.isNaN(Date.parse(value)));

describe('ErrorCodes', () => {
  test('exposes the full code catalogue with stable values', () => {
    expect(ErrorCodes).toEqual({
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      UNAUTHORIZED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      NOT_FOUND: 'NOT_FOUND',
      CONFLICT: 'CONFLICT',
      BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
      SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      BAD_GATEWAY: 'BAD_GATEWAY',
      NATS_TIMEOUT: 'NATS_TIMEOUT',
      NATS_NO_RESPONDERS: 'NATS_NO_RESPONDERS',
    });
  });

  test('maps every code to an HTTP status', () => {
    const codes = Object.values(ErrorCodes);
    expect(Object.keys(ErrorCodeToHttpStatus).sort()).toEqual([...codes].sort());
    for (const status of Object.values(ErrorCodeToHttpStatus)) {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });
});

describe('ErrorResponseSchema', () => {
  test('accepts a well-formed error response', () => {
    expect(Value.Check(ErrorResponseSchema, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Trip not found',
        traceId: '11111111-1111-4111-8111-111111111111',
      },
    })).toBe(true);
  });

  test('accepts optional details and rejects other success literals', () => {
    expect(Value.Check(ErrorResponseSchema, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'bad input',
        traceId: '11111111-1111-4111-8111-111111111111',
        details: { field: 'phone' },
      },
    })).toBe(true);

    expect(Value.Check(ErrorResponseSchema, {
      success: true,
      error: {
        code: 'NOT_FOUND',
        message: 'Trip not found',
        traceId: '11111111-1111-4111-8111-111111111111',
      },
    })).toBe(false);
  });

  test('ErrorDetailSchema shares the error object shape', () => {
    expect(ErrorDetailSchema).toMatchObject({
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        traceId: { type: 'string' },
        details: {},
      },
      required: ['code', 'message', 'traceId'],
    });
    expect(ErrorResponseSchema.properties).toHaveProperty('success');
  });
});

describe('TraceContextSchema', () => {
  test('accepts a valid trace context and rejects a missing serviceName', () => {
    expect(Value.Check(TraceContextSchema, {
      traceId: '11111111-1111-4111-8111-111111111111',
      serviceName: 'trip-service',
      timestamp: '2026-01-02T03:04:05Z',
    })).toBe(true);

    expect(Value.Check(TraceContextSchema, {
      traceId: '11111111-1111-4111-8111-111111111111',
      timestamp: '2026-01-02T03:04:05Z',
    })).toBe(false);
  });

  test('is a TypeBox object schema', () => {
    expect(TraceContextSchema[Kind]).toBe('Object');
  });
});
