/**
 * NATS request wrapper with timeout and error handling.
 */

import type { NatsConnection } from 'nats';
import { ServiceUnavailableError, AppError } from '../errors/index.js';
import { deserializeError } from './nats-serializer.js';
import { logError } from '../logger/index.js';
import type { Logger } from 'pino';

/**
 * Default NATS request timeout in milliseconds.
 */
export const DEFAULT_NATS_TIMEOUT = 3000;

/**
 * Options for NATS request.
 */
export interface NatsRequestOptions {
  timeout?: number;
  traceId: string;
  logger: Logger;
}

/**
 * Creates a NATS request with timeout and error handling.
 * 
 * @param nc - NATS connection
 * @param subject - Subject to send request to
 * @param data - Request payload
 * @param options - Request options including timeout and traceId
 * @returns Response data
 * @throws ServiceUnavailableError on timeout or no responders
 * @throws AppError if response contains serialized error
 */
export async function createNatsRequest<T>(
  nc: NatsConnection,
  subject: string,
  data: unknown,
  options: NatsRequestOptions
): Promise<T> {
  const { timeout = DEFAULT_NATS_TIMEOUT, traceId, logger } = options;

  try {
    // Create headers with traceId
    // const hdrs = nc.info?.headers ? nc.info.headers : undefined;

    // Send request with timeout
    const response = await nc.request(
      subject,
      Buffer.from(JSON.stringify(data)),
      { timeout }
    );

    // Decode response
    const responseStr = new TextDecoder().decode(response.data);
    const decoded = JSON.parse(responseStr);

    // Check if response is a serialized error
    const error = deserializeError(responseStr);
    if (error) {
      throw error;
    }

    return decoded as T;
  } catch (err: unknown) {
    // Handle NATS timeout
    if (isNatsTimeout(err)) {
      logError(logger, err, { traceId, subject, timeout, errorType: 'NATS_TIMEOUT' });
      throw new ServiceUnavailableError('Service temporarily unavailable');
    }

    // Handle NATS no responders
    if (isNatsNoResponders(err)) {
      logError(logger, err, { traceId, subject, errorType: 'NATS_NO_RESPONDERS' });
      throw new ServiceUnavailableError('Service not available');
    }

    // Re-throw AppError as-is
    if (err instanceof AppError) {
      throw err;
    }

    // Wrap unknown errors
    throw new ServiceUnavailableError('Request failed');
  }
}

/**
 * Type guard for NATS timeout error.
 */
function isNatsTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('TIMEOUT') || (err as any).code === 'TIMEOUT')
  );
}

/**
 * Type guard for NATS no responders error.
 */
function isNatsNoResponders(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('NO_RESPONDERS') || (err as any).code === 'NO_RESPONDERS')
  );
}
