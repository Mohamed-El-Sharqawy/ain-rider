/**
 * NATS error serialization utilities.
 * Preserves AppError type information across NATS wire protocol.
 */

import { AppError, InternalError } from '../errors/index.js';
import { ErrorCode } from '../schemas/index.js';

/**
 * Serialized error format for NATS transport.
 */
export interface SerializedError {
  __type: 'AppError';
  code: ErrorCode;
  message: string;
  httpStatus: number;
  details?: unknown;
  timestamp: string;
  stack?: string;
}

/**
 * Serializes an AppError for NATS transport.
 */
export function serializeError(error: AppError): string {
  const isProduction = process.env.NODE_ENV === 'production';

  const serialized: SerializedError = {
    __type: 'AppError',
    code: error.code,
    message: error.message,
    httpStatus: error.httpStatus,
    timestamp: error.timestamp,
  };

  if (error.details !== undefined) {
    serialized.details = error.details;
  }

  if (!isProduction && error.stack) {
    serialized.stack = error.stack;
  }

  return JSON.stringify(serialized);
}

/**
 * Deserializes an error from NATS transport.
 * Returns null if the data is not a serialized AppError.
 */
export function deserializeError(data: string): AppError | null {
  try {
    const parsed = JSON.parse(data) as SerializedError;

    if (parsed.__type !== 'AppError') {
      return null;
    }

    // Reconstruct AppError with preserved properties
    const error = new InternalError(parsed.message, parsed.details);
    
    // Override with actual values
    (error as any).code = parsed.code;
    (error as any).httpStatus = parsed.httpStatus;
    (error as any).timestamp = parsed.timestamp;
    
    if (parsed.stack) {
      (error as any).stack = parsed.stack;
    }

    return error;
  } catch {
    return null;
  }
}

/**
 * Checks if a value looks like a serialized error.
 */
export function isSerializedError(value: unknown): value is SerializedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    (value as SerializedError).__type === 'AppError'
  );
}
