/**
 * NotFoundError - for resource not found scenarios.
 * Maps to HTTP 404 Not Found.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class NotFoundError extends AppError {
  constructor(resourceName: string, identifier?: string | number) {
    const message = identifier
      ? `${resourceName} with ID '${identifier}' not found`
      : `${resourceName} not found`;
    super(ErrorCodes.NOT_FOUND, message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
