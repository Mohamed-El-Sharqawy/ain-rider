/**
 * TypeBox schema for unified error response.
 * All services must return errors in this format.
 */

import { Type, Static } from '@sinclair/typebox';

/**
 * Schema for the error object within the response.
 */
export const ErrorDetailSchema = Type.Object({
  code: Type.String({ pattern: '^[A-Z_]+$' }),
  message: Type.String({ minLength: 1 }),
  traceId: Type.String({ format: 'uuid' }),
  details: Type.Optional(Type.Unknown()),
});

/**
 * Full error response schema.
 */
export const ErrorResponseSchema = Type.Object({
  success: Type.Literal(false),
  error: ErrorDetailSchema,
});

/**
 * TypeScript type for error response.
 */
export type ErrorResponse = Static<typeof ErrorResponseSchema>;

/**
 * TypeScript type for error detail.
 */
export type ErrorDetail = Static<typeof ErrorDetailSchema>;
