/**
 * ConflictError - for resource conflict scenarios.
 * Maps to HTTP 409 Conflict.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCodes.CONFLICT, message, details);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
