/**
 * ValidationError - for request validation failures.
 * Maps to HTTP 400 Bad Request.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCodes.VALIDATION_ERROR, message, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
