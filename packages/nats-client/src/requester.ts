// ─── NATS Request-Reply ──────────────────────────────────────────────────────
// Enables synchronous request-reply pattern over NATS.
// Used by admin-service to trigger writes in other services without direct DB access.

import { NatsConnection, Msg, headers as natsHeaders } from 'nats';
import { 
  ServiceUnavailableError, 
  deserializeError, 
  createLogger
} from '@ain-rider/error-handling';

export interface RequestOptions {
  timeout?: number; // milliseconds, default 3000
  traceId?: string;
  logger?: ReturnType<typeof createLogger>;
}

const DEFAULT_TIMEOUT = 3000;

export class NatsRequester {
  constructor(private nc: NatsConnection) {}

  /**
   * Send a request and wait for a reply.
   * Subject convention: {service}.{entity}.{action}.request
   * Example: trip.create.request, trip.cancel.request
   */
  async request<TRequest, TResponse>(
    subject: string,
    data: TRequest,
    options?: RequestOptions,
  ): Promise<TResponse> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const traceId = options?.traceId ?? 'unknown';
    const logger = options?.logger;
    const payload = JSON.stringify(data);

    try {
      const hdrs = natsHeaders();
      if (traceId) {
        hdrs.set('X-Trace-Id', traceId);
      }

      const msg: Msg = await this.nc.request(
        subject,
        new TextEncoder().encode(payload),
        { timeout, headers: hdrs },
      );

      const response = JSON.parse(new TextDecoder().decode(msg.data));

      // Check if response is a serialized AppError
      const error = deserializeError(JSON.stringify(response));
      if (error) {
        throw error;
      }

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data as TResponse;
    } catch (error: any) {
      if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
        logger?.error('NATS request timeout', { subject, timeout, traceId });
        throw new ServiceUnavailableError(`Service request to ${subject} timed out after ${timeout}ms`);
      }
      if (error.code === 'NO_RESPONDERS' || error.message?.includes('no responders')) {
        logger?.error('NATS no responders', { subject, traceId });
        throw new ServiceUnavailableError(`Service at ${subject} is not available`);
      }
      throw error;
    }
  }
}

export function createRequester(nc: NatsConnection): NatsRequester {
  return new NatsRequester(nc);
}
