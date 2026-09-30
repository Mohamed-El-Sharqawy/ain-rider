/**
 * ServiceUnavailableError - for downstream service failures.
 * Maps to HTTP 503 Service Unavailable.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(ErrorCodes.SERVICE_UNAVAILABLE, message);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}
