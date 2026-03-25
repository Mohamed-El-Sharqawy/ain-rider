import {
  NatsConnection,
  JetStreamClient,
  JsMsg,
  AckPolicy,
  DeliverPolicy,
} from "nats";

export interface ConsumerOptions {
  stream: string;
  consumer: string;
  filterSubject?: string;
  deliverPolicy?: "all" | "last" | "new";
  ackWait?: number; // milliseconds
  maxDeliver?: number;
}

export type MessageHandler<T = any> = (data: T, msg: JsMsg) => Promise<void>;

export class NatsConsumer {
  private js: JetStreamClient;

  constructor(private nc: NatsConnection) {
    this.js = nc.jetstream();
  }

  async subscribe<T = any>(
    subject: string,
    handler: MessageHandler<T>,
    options?: Partial<ConsumerOptions>,
  ): Promise<void> {
    // Determine stream based on subject - use AIN_RIDER_OPS for operational events
    const streamName = options?.stream || this.getStreamForSubject(subject);

    // Create consumer if it doesn't exist (stream should already exist from setup)
    const consumerName = options?.consumer || `${subject.replace(/\./g, '_')}-consumer`;
    await this.ensureConsumer(
      streamName,
      consumerName,
      subject,
    );

    try {
      const consumer = await this.js.consumers.get(streamName, consumerName);

      const messages = await consumer.consume();

      console.log(`[NATS Consumer] Subscribed to ${subject} on stream ${streamName}`);

      for await (const msg of messages) {
        try {
          const data = JSON.parse(new TextDecoder().decode(msg.data)) as T;
          await handler(data, msg);
          msg.ack();
        } catch (error) {
          console.error(`[NATS Consumer] Error processing message:`, error);
          msg.nak();
        }
      }
    } catch (error) {
      console.error(
        `[NATS Consumer] Subscription failed for ${subject}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Determine the appropriate stream for a subject
   */
  private getStreamForSubject(subject: string): string {
    // Financial events go to AIN_RIDER_FINANCIAL
    const financialSubjects = [
      'ain_rider.payment_processed',
      'ain_rider.wallet_updated',
      'ain_rider.withdrawal_requested',
      'ain_rider.withdrawal_processed',
    ];
    
    if (financialSubjects.some(s => subject.startsWith(s.replace('ain_rider.', '')))) {
      return 'AIN_RIDER_FINANCIAL';
    }
    
    // DLQ events
    if (subject.startsWith('ain_rider.dlq.')) {
      return 'AIN_RIDER_DLQ';
    }
    
    // All other operational events go to AIN_RIDER_OPS
    return 'AIN_RIDER_OPS';
  }

  async ensureConsumer(
    streamName: string,
    consumerName: string,
    filterSubject: string,
  ): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.consumers.info(streamName, consumerName);
      console.log(`[NATS] Consumer ${consumerName} already exists`);
    } catch (err: any) {
      if (err?.api_error?.err_code === 10014) {
        // Consumer not found — create it
        await jsm.consumers.add(streamName, {
          durable_name: consumerName,
          filter_subject: filterSubject,
          ack_policy: AckPolicy.Explicit,
          deliver_policy: DeliverPolicy.All,
        });
        console.log(
          `[NATS] Consumer ${consumerName} created for ${filterSubject} on ${streamName}`,
        );
      } else {
        throw err;
      }
    }
  }
}

export function createConsumer(nc: NatsConnection): NatsConsumer {
  return new NatsConsumer(nc);
}
