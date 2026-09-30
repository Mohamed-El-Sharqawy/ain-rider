/**
 * TraceId utilities for request correlation.
 */

/**
 * Generates a new trace ID using crypto.randomUUID.
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts trace ID from HTTP headers.
 * Checks both 'X-Trace-Id' and 'x-trace-id' (case-insensitive).
 */
export function extractTraceId(headers: Headers | Record<string, string>): string | null {
  if (headers instanceof Headers) {
    return headers.get('x-trace-id') || headers.get('X-Trace-Id');
  }
  
  // Handle plain object headers
  const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
  return traceId || null;
}

/**
 * Creates trace context for logging and propagation.
 */
export interface TraceContextData {
  traceId: string;
  serviceName: string;
}

export function createTraceContext(traceId: string, serviceName: string): TraceContextData {
  return {
    traceId,
    serviceName,
  };
}
