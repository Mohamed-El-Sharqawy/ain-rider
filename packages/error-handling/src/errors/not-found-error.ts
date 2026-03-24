/**
 * NotFoundError - for resource not found scenarios.
 * Maps to HTTP 404 Not Found.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class NotFoundError extends AppError {
  constructor(resourceNameOrMessage: string, identifier?: string | number) {
    // If identifier provided, treat first arg as resource name and add suffix
    // Otherwise, treat as full message (e.g., from HttpException)
    const message = identifier
      ? `${resourceNameOrMessage} with ID '${identifier}' not found`
      : resourceNameOrMessage;
    super(ErrorCodes.NOT_FOUND, message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}
