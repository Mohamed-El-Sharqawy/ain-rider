/**
 * TooManyRequestsError - for rate limits and attempt caps.
 * Maps to HTTP 429 Too Many Requests.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', details?: unknown) {
    super(ErrorCodes.TOO_MANY_REQUESTS, message, details);
    Object.setPrototypeOf(this, TooManyRequestsError.prototype);
  }
}
