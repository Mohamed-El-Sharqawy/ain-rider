import { NatsConnection, JetStreamClient, JetStreamPublishOptions } from 'nats';
import { NatsEvent } from '@ain-rider/shared-types';

export class NatsPublisher {
  private js: JetStreamClient;

  constructor(private nc: NatsConnection) {
    this.js = this.nc.jetstream();
  }

  async publish<T extends NatsEvent>(
    event: T,
    options?: Partial<JetStreamPublishOptions>
  ): Promise<void> {
    try {
      const payload = JSON.stringify(event.data);
      await this.js.publish(event.subject, new TextEncoder().encode(payload), options);
      console.log(`[NATS Publisher] Published to ${event.subject}`);
    } catch (error) {
      console.error(`[NATS Publisher] Failed to publish to ${event.subject}:`, error);
      throw error;
    }
  }

  async publishBatch(events: NatsEvent[]): Promise<void> {
    const promises = events.map((event) => this.publish(event));
    await Promise.all(promises);
  }
}

export function createPublisher(nc: NatsConnection): NatsPublisher {
  return new NatsPublisher(nc);
}
