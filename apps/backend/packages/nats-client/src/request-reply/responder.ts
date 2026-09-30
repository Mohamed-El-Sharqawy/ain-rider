/**
 * NATS Request Responder
 * 
 * Base class for handling synchronous request-reply messages.
 * Used by services to respond to admin-service commands.
 */

import { NatsConnection, Subscription } from 'nats';
import {
  NatsRequest,
  createSuccessResponse,
  createErrorResponse,
} from '../types/requests';
import { extractOrGenerateTraceId } from '../tracing';

export type RequestHandler<TRequest, TResponse> = (
  request: NatsRequest<TRequest>
) => Promise<TResponse>;

export interface ResponderConfig {
  /** Subject to listen on (e.g., 'user.suspend.request') */
  subject: string;
  
  /** Service name for logging */
  serviceName?: string;
}

export class NatsResponder {
  private subscription: Subscription | null = null;
  private serviceName: string;

  constructor(
    private nc: NatsConnection,
    private config: ResponderConfig
  ) {
    this.serviceName = config.serviceName || process.env.SERVICE_NAME || 'unknown-service';
  }

  /**
   * Start listening for requests
   * 
   * @param handler - Function to handle requests
   */
  async respond<TRequest, TResponse>(
    handler: RequestHandler<TRequest, TResponse>
  ): Promise<void> {
    this.subscription = this.nc.subscribe(this.config.subject);

    console.log(
      `[${this.serviceName}] Listening on ${this.config.subject}`
    );

    (async () => {
      for await (const msg of this.subscription!) {
        await this.handleMessage(msg, handler);
      }
    })().catch((error) => {
      console.error(
        `[${this.serviceName}] Responder loop error on ${this.config.subject}:`,
        error
      );
    });
  }

  /**
   * Handle a single request message
   */
  private async handleMessage<TRequest, TResponse>(
    msg: any,
    handler: RequestHandler<TRequest, TResponse>
  ): Promise<void> {
    const traceId = extractOrGenerateTraceId(msg.headers);

    try {
      const payload = new TextDecoder().decode(msg.data);
      const request: NatsRequest<TRequest> = JSON.parse(payload);

      console.log(
        `[${this.serviceName}] Received request on ${this.config.subject} | traceId=${traceId}`
      );

      // Call handler
      const result = await handler(request);

      // Send success response
      const response = createSuccessResponse(result, traceId);
      msg.respond(new TextEncoder().encode(JSON.stringify(response)));

      console.log(
        `[${this.serviceName}] Responded to ${this.config.subject} | traceId=${traceId}`
      );
    } catch (error: any) {
      console.error(
        `[${this.serviceName}] Error handling request on ${this.config.subject} | traceId=${traceId}`,
        error
      );

      // Send error response
      const response = createErrorResponse(
        error.code || 'INTERNAL_ERROR',
        error.message || 'Unknown error',
        traceId,
        error.details
      );
      msg.respond(new TextEncoder().encode(JSON.stringify(response)));
    }
  }

  /**
   * Stop listening for requests
   */
  async stop(): Promise<void> {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
      console.log(
        `[${this.serviceName}] Stopped listening on ${this.config.subject}`
      );
    }
  }
}

/**
 * Factory function to create a NatsResponder
 */
export function createNatsResponder(
  nc: NatsConnection,
  config: ResponderConfig
): NatsResponder {
  return new NatsResponder(nc, config);
}
