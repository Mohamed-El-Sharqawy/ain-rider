/**
 * UnauthorizedError - for authentication failures.
 * Maps to HTTP 401 Unauthorized.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCodes.UNAUTHORIZED, message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}
