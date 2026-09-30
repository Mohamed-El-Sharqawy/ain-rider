/**
 * Tracing Utilities
 * 
 * W3C Trace Context implementation for distributed tracing
 * @see https://www.w3.org/TR/trace-context/
 */

import { randomUUID } from 'crypto';
import { MsgHdrs } from 'nats';

/**
 * Generate a W3C-compatible trace ID (32 hex chars, no dashes)
 */
export function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * Generate a W3C-compatible span ID (16 hex chars)
 */
export function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').substring(0, 16);
}

/**
 * Create a W3C traceparent header value
 * Format: 00-{traceId}-{spanId}-01
 * 
 * @param traceId - 32 hex char trace ID
 * @param spanId - Optional 16 hex char span ID (auto-generated if not provided)
 */
export function createTraceparent(traceId: string, spanId?: string): string {
  const span = spanId || generateSpanId();
  return `00-${traceId}-${span}-01`;
}

/**
 * Extract trace ID from W3C traceparent header
 * 
 * @param headers - NATS message headers
 * @returns trace ID or undefined if not present
 */
export function extractTraceId(headers: MsgHdrs): string | undefined {
  try {
    const traceparent = headers.get('traceparent');
    if (!traceparent) return undefined;

    // Parse traceparent: version-traceid-spanid-flags
    const parts = traceparent.split('-');
    if (parts.length !== 4) return undefined;

    const [, traceId] = parts;
    if (traceId.length !== 32) return undefined;

    return traceId;
  } catch {
    return undefined;
  }
}

/**
 * Extract trace ID from headers or generate a new one
 * 
 * @param headers - Optional NATS message headers
 * @returns Existing trace ID or newly generated one
 */
export function extractOrGenerateTraceId(headers?: MsgHdrs): string {
  if (headers) {
    const existing = extractTraceId(headers);
    if (existing) return existing;
  }
  return generateTraceId();
}

/**
 * Extract span ID from W3C traceparent header
 * 
 * @param headers - NATS message headers
 * @returns span ID or undefined if not present
 */
export function extractSpanId(headers: MsgHdrs): string | undefined {
  try {
    const traceparent = headers.get('traceparent');
    if (!traceparent) return undefined;

    const parts = traceparent.split('-');
    if (parts.length !== 4) return undefined;

    const [, , spanId] = parts;
    return spanId;
  } catch {
    return undefined;
  }
}

/**
 * Create a child traceparent (same trace, new span)
 * 
 * @param parentTraceId - Parent trace ID
 * @returns New traceparent with same trace ID but new span ID
 */
export function createChildTraceparent(parentTraceId: string): string {
  return createTraceparent(parentTraceId, generateSpanId());
}
