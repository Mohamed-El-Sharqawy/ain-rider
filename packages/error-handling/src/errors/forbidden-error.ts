/**
 * ForbiddenError - for authorization failures.
 * Maps to HTTP 403 Forbidden.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(ErrorCodes.FORBIDDEN, message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}
