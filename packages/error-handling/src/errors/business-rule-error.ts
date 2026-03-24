/**
 * BusinessRuleError - for business rule violations.
 * Maps to HTTP 422 Unprocessable Entity.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCodes.BUSINESS_RULE_VIOLATION, message, details);
    Object.setPrototypeOf(this, BusinessRuleError.prototype);
  }
}
