/**
 * Trace middleware for Elysia API Gateway.
 * Extracts or generates trace ID for request correlation.
 */

import { Elysia } from 'elysia';
import { generateTraceId, extractTraceId } from '@ain-rider/error-handling';

/**
 * Trace middleware plugin for Elysia.
 * Adds traceId to store and context for error handling and logging.
 */
export const traceMiddleware = new Elysia({ name: 'trace-middleware' })
  .state('traceId', '')
  .derive(({ request, store }) => {
    const traceId = extractTraceId(request.headers) || generateTraceId();
    store.traceId = traceId;
    return { traceId };
  });
