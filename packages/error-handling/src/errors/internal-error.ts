/**
 * InternalError - for unexpected server errors.
 * Maps to HTTP 500 Internal Server Error.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class InternalError extends AppError {
  constructor(message: string = 'An unexpected error occurred', details?: unknown) {
    super(ErrorCodes.INTERNAL_ERROR, message, details);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}
