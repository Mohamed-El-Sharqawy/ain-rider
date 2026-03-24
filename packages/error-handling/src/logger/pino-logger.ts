/**
 * Pino logger wrapper with traceId injection and sensitive data sanitization.
 */

import pino, { Logger } from 'pino';
import { sanitize } from './sanitizer.js';

export interface LoggerConfig {
  serviceName: string;
  level?: string;
}

/**
 * Creates a configured Pino logger instance.
 */
export function createLogger(config: LoggerConfig): Logger {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return pino({
    name: config.serviceName,
    level: config.level || (isProduction ? 'info' : 'debug'),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      serviceName: config.serviceName,
    },
    redact: {
      paths: ['password', 'token', 'secret', 'key', 'authorization', 'credential', 'apikey', 'api_key'],
      censor: '[REDACTED]',
    },
  });
}

/**
 * Context for error logging.
 */
export interface ErrorLogContext {
  traceId?: string;
  serviceName?: string;
  [key: string]: unknown;
}

/**
 * Logs an error with structured context.
 */
export function logError(
  logger: Logger,
  error: unknown,
  context: ErrorLogContext = {}
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Sanitize context
  const sanitizedContext = sanitize(context) as ErrorLogContext;

  if (error instanceof Error) {
    const errorInfo: Record<string, unknown> = {
      errorType: error.constructor.name,
      message: error.message,
      ...sanitizedContext,
    };

    // Include stack trace only in non-production
    if (!isProduction && error.stack) {
      errorInfo.stack = error.stack;
    }

    // If error has additional properties, sanitize them
    const errorObj = error as unknown as Record<string, unknown>;
    if (errorObj.details) {
      errorInfo.details = sanitize(errorObj.details);
    }
    if (errorObj.code) {
      errorInfo.code = errorObj.code;
    }

    logger.error(errorInfo, error.message);
  } else {
    // Handle non-Error throws
    logger.error(
      {
        errorType: 'UnknownError',
        value: sanitize(error),
        ...sanitizedContext,
      },
      'An unknown error occurred'
    );
  }
}

/**
 * Logs an info message with context.
 */
export function logInfo(
  logger: Logger,
  message: string,
  context: Record<string, unknown> = {}
): void {
  logger.info(sanitize(context) as Record<string, unknown>, message);
}

/**
 * Logs a warning message with context.
 */
export function logWarn(
  logger: Logger,
  message: string,
  context: Record<string, unknown> = {}
): void {
  logger.warn(sanitize(context) as Record<string, unknown>, message);
}

/**
 * Logs a debug message with context.
 */
export function logDebug(
  logger: Logger,
  message: string,
  context: Record<string, unknown> = {}
): void {
  logger.debug(sanitize(context) as Record<string, unknown>, message);
}
