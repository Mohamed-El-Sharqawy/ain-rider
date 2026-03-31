// ─── NATS Responder ──────────────────────────────────────────────────────────
// Handles incoming request-reply messages.
// Used by trip-service, payment-service etc to respond to admin-service commands.

import { NatsConnection, Subscription } from 'nats';

export type RequestHandler<TRequest, TResponse> = (
  data: TRequest,
) => Promise<TResponse>;

export class NatsResponder {
  private subscriptions: Subscription[] = [];

  constructor(private nc: NatsConnection) {}

  /**
   * Subscribe to a request subject and auto-reply.
   * Handler should return the response data or throw an error.
   */
  async respond<TRequest, TResponse>(
    subject: string,
    handler: RequestHandler<TRequest, TResponse>,
  ): Promise<void> {
    const sub = this.nc.subscribe(subject);
    this.subscriptions.push(sub);

    console.log(`[NATS Responder] Listening on ${subject}`);

    (async () => {
      for await (const msg of sub) {
        let traceId = 'unknown';
        try {
          const payload = new TextDecoder().decode(msg.data);
          const rawRequest = JSON.parse(payload);
          
          let requestPayload: any;
          // Support both wrapped NatsRequest and raw data
          if (rawRequest && typeof rawRequest === 'object' && 'data' in rawRequest && 'traceId' in rawRequest) {
             requestPayload = rawRequest.data;
             traceId = rawRequest.traceId || traceId;
          } else {
             requestPayload = rawRequest;
          }

          const result = await handler(requestPayload);

          const response = JSON.stringify({ 
            success: true,
            data: result, 
            error: null,
            traceId
          });
          msg.respond(new TextEncoder().encode(response));
        } catch (error: any) {
          console.error(`[LegacyNatsResponder] Error on ${subject}:`, error);
          const errorResponse = JSON.stringify({
            success: false,
            data: null,
            error: {
              code: error.code || 'INTERNAL_ERROR',
              message: error.message || 'Unknown error',
            },
            traceId
          });
          msg.respond(new TextEncoder().encode(errorResponse));
        }
      }
    })();
  }

  async close(): Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
  }
}

export function createResponder(nc: NatsConnection): NatsResponder {
  return new NatsResponder(nc);
}
