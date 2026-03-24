/**
 * Base AppError class for all application errors.
 * Provides unified error handling across Elysia and NestJS services.
 */

import { ErrorCode, ErrorCodeToHttpStatus, ErrorResponse } from '../schemas/index.js';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = ErrorCodeToHttpStatus[code];
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Converts the error to a unified error response format.
   */
  toResponse(traceId: string): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        traceId,
      },
    };

    // Include details in development or for validation errors
    const isProduction = process.env.NODE_ENV === 'production';
    if (this.details && (!isProduction || this.code === 'VALIDATION_ERROR')) {
      response.error.details = this.details;
    }

    return response;
  }

  /**
   * Returns a JSON-serializable representation of the error.
   */
  toJSON(): Record<string, unknown> {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      __type: 'AppError',
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      details: this.details,
      timestamp: this.timestamp,
      stack: isProduction ? undefined : this.stack,
    };
  }
}
