/**
 * NATS error handler for payment-service.
 * Serializes AppError for NATS replies.
 */

import { AppError } from '@ain-rider/error-handling';

export function handleNatsError(error: AppError, traceId: string): string {
  return JSON.stringify(error.toResponse(traceId));
}
