/**
 * NATS Request Client
 * 
 * Client for synchronous request-reply pattern over NATS Core.
 * Used by admin-service to trigger operations in other services.
 * 
 * Default timeout: 5000ms (5 seconds)
 */

import { NatsConnection, Msg, headers as natsHeaders } from 'nats';
import {
  NatsRequest,
  NatsResponse,
  createNatsRequest,
} from '../types/requests';
import { generateTraceId, createTraceparent } from '../tracing';

export interface RequestOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  
  /** Trace ID for distributed tracing */
  traceId?: string;
  
  /** Service or user making the request */
  requestedBy?: string;
}

const DEFAULT_TIMEOUT = 5000; // 5 seconds

export class NatsRequestClient {
  constructor(private nc: NatsConnection) {}

  /**
   * Send a request and wait for a reply
   * 
   * @param subject - Request subject (e.g., 'user.suspend.request')
   * @param data - Request payload
   * @param options - Request options
   * @returns Response data
   * @throws ServiceUnavailableError if timeout or no responders
   */
  async request<TRequest, TResponse>(
    subject: string,
    data: TRequest,
    options?: RequestOptions
  ): Promise<TResponse> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const traceId = options?.traceId ?? generateTraceId();
    const requestedBy = options?.requestedBy ?? process.env.SERVICE_NAME ?? 'unknown';

    // Create request envelope
    const request: NatsRequest<TRequest> = createNatsRequest(data, {
      traceId,
      requestedBy,
    });

    // Create headers
    const hdrs = natsHeaders();
    hdrs.set('traceparent', createTraceparent(traceId));
    hdrs.set('Nats-Request-By', requestedBy);

    try {
      const payload = JSON.stringify(request);
      const msg: Msg = await this.nc.request(
        subject,
        new TextEncoder().encode(payload),
        { timeout, headers: hdrs }
      );

      const response: NatsResponse<TResponse> = JSON.parse(
        new TextDecoder().decode(msg.data)
      );

      // Check for error in response
      if (!response.success) {
        const error = response.error!;
        const err = new Error(error.message);
        (err as any).code = error.code;
        (err as any).details = error.details;
        throw err;
      }

      console.log(
        `[NatsRequestClient] Request to ${subject} succeeded | traceId=${traceId}`
      );

      return response.data!;
    } catch (error: any) {
      // Handle timeout
      if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
        console.error(
          `[NatsRequestClient] Request to ${subject} timed out after ${timeout}ms | traceId=${traceId}`
        );
        const err = new Error(`Request to ${subject} timed out after ${timeout}ms`);
        (err as any).code = 'TIMEOUT';
        throw err;
      }

      // Handle no responders
      if (error.code === 'NO_RESPONDERS' || error.message?.includes('no responders')) {
        console.error(
          `[NatsRequestClient] No responders for ${subject} | traceId=${traceId}`
        );
        const err = new Error(`No service available at ${subject}`);
        (err as any).code = 'NO_RESPONDERS';
        throw err;
      }

      console.error(
        `[NatsRequestClient] Request to ${subject} failed | traceId=${traceId}`,
        error
      );
      throw error;
    }
  }
}

/**
 * Factory function to create a NatsRequestClient
 */
export function createNatsRequestClient(nc: NatsConnection): NatsRequestClient {
  return new NatsRequestClient(nc);
}
