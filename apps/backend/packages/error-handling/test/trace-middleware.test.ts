import { describe, expect, test } from 'vitest';
import { createTraceContext, extractTraceId, generateTraceId } from '../src';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('generateTraceId', () => {
  test('produces a unique uuid every call', () => {
    const first = generateTraceId();
    const second = generateTraceId();

    expect(first).toMatch(UUID_RE);
    expect(second).toMatch(UUID_RE);
    expect(first).not.toBe(second);
  });
});

describe('extractTraceId', () => {
  test('reads x-trace-id from a Headers instance', () => {
    const headers = new Headers({ 'x-trace-id': 'trace-abc' });
    expect(extractTraceId(headers)).toBe('trace-abc');
  });

  test('reads X-Trace-Id from a Headers instance', () => {
    const headers = new Headers({ 'X-Trace-Id': 'trace-def' });
    expect(extractTraceId(headers)).toBe('trace-def');
  });

  test('returns null when the Headers instance has no trace id', () => {
    expect(extractTraceId(new Headers({ 'content-type': 'application/json' }))).toBeNull();
  });

  test('reads x-trace-id from a plain header record', () => {
    expect(extractTraceId({ 'x-trace-id': 'trace-ghi' })).toBe('trace-ghi');
  });

  test('reads X-Trace-Id from a plain header record', () => {
    expect(extractTraceId({ 'X-Trace-Id': 'trace-jkl' })).toBe('trace-jkl');
  });

  test('returns null when the record has no trace id', () => {
    expect(extractTraceId({ accept: '*/*' })).toBeNull();
  });
});

describe('createTraceContext', () => {
  test('pairs the trace id with the service name', () => {
    expect(createTraceContext('trace-1', 'trip-service')).toEqual({
      traceId: 'trace-1',
      serviceName: 'trip-service',
    });
  });
});
