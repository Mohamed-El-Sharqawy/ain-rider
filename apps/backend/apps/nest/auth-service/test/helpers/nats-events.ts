import { createTestNatsConnection } from "@ain-rider/test-utils";

/**
 * Observes events published on a JetStream subject by subscribing to the
 * corresponding core NATS subject (JetStream publishes flow through core
 * NATS). Create the subscription BEFORE triggering the publish, then await
 * next() to receive the decoded envelope.
 */
export async function subscribeNewEvents(subject: string, name = "verifier") {
  const nc = await createTestNatsConnection(name);
  const sub = nc.subscribe(subject);

  return {
    /** Resolves with the next event envelope published on the subject. */
    next(timeoutMs = 15_000): Promise<any> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          sub.unsubscribe();
          reject(new Error(`Timed out waiting for event on ${subject}`));
        }, timeoutMs);

        (async () => {
          for await (const msg of sub) {
            clearTimeout(timer);
            sub.unsubscribe();
            resolve(JSON.parse(new TextDecoder().decode(msg.data)));
            return;
          }
        })().catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    },
  };
}
