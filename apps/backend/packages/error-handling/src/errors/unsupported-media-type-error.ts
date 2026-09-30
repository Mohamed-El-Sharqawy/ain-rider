/**
 * UnsupportedMediaTypeError - for rejected upload mimetypes.
 * Maps to HTTP 415 Unsupported Media Type.
 */

import { AppError } from './app-error.js';
import { ErrorCodes } from '../schemas/index.js';

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string = 'Unsupported media type', details?: unknown) {
    super(ErrorCodes.UNSUPPORTED_MEDIA_TYPE, message, details);
    Object.setPrototypeOf(this, UnsupportedMediaTypeError.prototype);
  }
}
