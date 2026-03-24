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
        try {
          const request = JSON.parse(
            new TextDecoder().decode(msg.data),
          ) as TRequest;

          const result = await handler(request);

          const response = JSON.stringify({ data: result, error: null });
          msg.respond(new TextEncoder().encode(response));
        } catch (error: any) {
          const errorResponse = JSON.stringify({
            data: null,
            error: error.message || 'Unknown error',
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
