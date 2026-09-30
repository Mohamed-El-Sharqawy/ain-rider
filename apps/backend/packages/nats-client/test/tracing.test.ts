import { describe, expect, test } from 'vitest';
import { headers } from 'nats';
import {
  createChildTraceparent,
  createTraceparent,
  extractOrGenerateTraceId,
  extractSpanId,
  extractTraceId,
  generateSpanId,
  generateTraceId,
} from '../src/tracing/trace-context';

const TRACE_ID = 'a'.repeat(32);
const SPAN_ID = 'b'.repeat(16);

function hdrs(traceparent?: string) {
  const h = headers();
  if (traceparent !== undefined) {
    h.set('traceparent', traceparent);
  }
  return h;
}

describe('generateTraceId', () => {
  test('produces 32 lowercase hex chars without dashes', () => {
    const id = generateTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain('-');
  });

  test('produces unique ids', () => {
    expect(generateTraceId()).not.toBe(generateTraceId());
  });
});

describe('generateSpanId', () => {
  test('produces 16 hex chars', () => {
    expect(generateSpanId()).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('createTraceparent', () => {
  test('formats version-traceid-spanid-flags with generated span', () => {
    const tp = createTraceparent(TRACE_ID);
    expect(tp).toMatch(new RegExp(`^00-${TRACE_ID}-[0-9a-f]{16}-01$`));
  });

  test('uses the provided span id', () => {
    expect(createTraceparent(TRACE_ID, SPAN_ID)).toBe(
      `00-${TRACE_ID}-${SPAN_ID}-01`,
    );
  });
});

describe('extractTraceId', () => {
  test('extracts the trace id from a valid traceparent', () => {
    expect(extractTraceId(hdrs(`00-${TRACE_ID}-${SPAN_ID}-01`))).toBe(TRACE_ID);
  });

  test('returns undefined when the header is missing', () => {
    expect(extractTraceId(hdrs())).toBeUndefined();
  });

  test('returns undefined for a malformed traceparent', () => {
    expect(extractTraceId(hdrs('not-a-traceparent'))).toBeUndefined();
  });

  test('returns undefined when the trace id is not 32 chars', () => {
    expect(extractTraceId(hdrs('00-shortspan-abc-01'))).toBeUndefined();
  });

  test('returns undefined when the header access throws', () => {
    const throwing = {
      get: () => {
        throw new Error('boom');
      },
    } as unknown as Parameters<typeof extractTraceId>[0];
    expect(extractTraceId(throwing)).toBeUndefined();
  });
});

describe('extractSpanId', () => {
  test('extracts the span id from a valid traceparent', () => {
    expect(extractSpanId(hdrs(`00-${TRACE_ID}-${SPAN_ID}-01`))).toBe(SPAN_ID);
  });

  test('returns undefined when the header is missing', () => {
    expect(extractSpanId(hdrs())).toBeUndefined();
  });

  test('returns undefined for a malformed traceparent', () => {
    expect(extractSpanId(hdrs('only-two-parts'))).toBeUndefined();
  });

  test('returns undefined when the header access throws', () => {
    const throwing = {
      get: () => {
        throw new Error('boom');
      },
    } as unknown as Parameters<typeof extractSpanId>[0];
    expect(extractSpanId(throwing)).toBeUndefined();
  });
});

describe('extractOrGenerateTraceId', () => {
  test('returns the existing trace id when present', () => {
    expect(extractOrGenerateTraceId(hdrs(`00-${TRACE_ID}-${SPAN_ID}-01`))).toBe(
      TRACE_ID,
    );
  });

  test('generates a new trace id when the header is absent', () => {
    const id = extractOrGenerateTraceId(hdrs());
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  test('generates a new trace id when headers are undefined', () => {
    const id = extractOrGenerateTraceId(undefined);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('createChildTraceparent', () => {
  test('keeps the trace id but rotates the span id', () => {
    const parent = createTraceparent(TRACE_ID, SPAN_ID);
    const child = createChildTraceparent(TRACE_ID);
    expect(child).not.toBe(parent);
    const parts = child.split('-');
    expect(parts[0]).toBe('00');
    expect(parts[1]).toBe(TRACE_ID);
    expect(parts[2]).toMatch(/^[0-9a-f]{16}$/);
    expect(parts[2]).not.toBe(SPAN_ID);
    expect(parts[3]).toBe('01');
  });
});
