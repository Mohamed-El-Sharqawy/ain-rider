/**
 * Trace middleware for Elysia Match Service.
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
  // as: 'scoped' is required: without it the derive only applies to routes
  // registered on this plugin instance (there are none), so it never runs
  .derive({ as: 'scoped' }, ({ request, store }) => {
    const traceId = extractTraceId(request.headers) || generateTraceId();
    store.traceId = traceId;
    return { traceId };
  });
