// ─── NATS Request-Reply ──────────────────────────────────────────────────────
// Enables synchronous request-reply pattern over NATS.
// Used by admin-service to trigger writes in other services without direct DB access.

import { NatsConnection, Msg } from 'nats';

export interface RequestOptions {
  timeout?: number; // milliseconds, default 5000
}

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
    const timeout = options?.timeout ?? 5000;
    const payload = JSON.stringify(data);

    try {
      const msg: Msg = await this.nc.request(
        subject,
        new TextEncoder().encode(payload),
        { timeout },
      );

      const response = JSON.parse(new TextDecoder().decode(msg.data));

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data as TResponse;
    } catch (error: any) {
      if (error.code === 'TIMEOUT') {
        throw new Error(`NATS request to ${subject} timed out after ${timeout}ms`);
      }
      throw error;
    }
  }
}

export function createRequester(nc: NatsConnection): NatsRequester {
  return new NatsRequester(nc);
}
