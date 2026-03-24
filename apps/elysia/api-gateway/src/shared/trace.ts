/**
 * Trace middleware for Elysia API Gateway.
 * Extracts or generates trace ID for request correlation.
 */

import { Elysia } from 'elysia';
import { generateTraceId, extractTraceId } from '@ain-rider/error-handling';

/**
 * Trace middleware plugin for Elysia.
 * Adds traceId to store for error handling and logging.
 * Uses transform to run before route matching and validation.
 */
export const traceMiddleware = new Elysia({ name: 'trace-middleware' })
  .state('traceId', 'unknown')
  .onTransform(({ request, store }) => {
    const headers = request.headers as unknown as Record<string, string>;
    const traceId = extractTraceId(headers) || generateTraceId();
    store.traceId = traceId;
  });
