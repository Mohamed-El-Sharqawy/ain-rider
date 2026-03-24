/**
 * TypeBox schema for trace context.
 * Used for request correlation across services.
 */

import { Type, Static } from '@sinclair/typebox';

/**
 * Schema for trace context passed between services.
 */
export const TraceContextSchema = Type.Object({
  traceId: Type.String({ format: 'uuid' }),
  serviceName: Type.String({ minLength: 1 }),
  timestamp: Type.String({ format: 'date-time' }),
});

/**
 * TypeScript type for trace context.
 */
export type TraceContext = Static<typeof TraceContextSchema>;
