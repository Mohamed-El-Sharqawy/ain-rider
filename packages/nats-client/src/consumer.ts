import {
  NatsConnection,
  JetStreamClient,
  JsMsg,
  RetentionPolicy,
  StorageType,
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
    const streamName = options?.stream || "AIN_RIDER";

    // ✅ Always ensure stream exists before consuming
    await this.ensureStream(streamName, [subject]);

    // ✅ Create consumer if it doesn't exist
    const consumerName = options?.consumer || `${subject.replace(/\./g, '_')}-consumer`;
    await this.ensureConsumer(
      streamName,
      consumerName,
      subject,
    );

    try {
      const consumer = await this.js.consumers.get(
        options?.stream || "AIN_RIDER",
        consumerName,
      );

      const messages = await consumer.consume();

      console.log(`[NATS Consumer] Subscribed to ${subject}`);

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

  // Rename createStream → ensureStream with upsert logic
  async ensureStream(streamName: string, _subjects: string[]): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.streams.info(streamName);
      console.log(`[NATS] Stream ${streamName} already exists`);
      // Don't update subjects — wildcard covers everything
    } catch (err: any) {
      if (err?.api_error?.err_code === 10059) {
        await jsm.streams.add({
          name: streamName,
          subjects: ["ain_rider.>"], // ✅ wildcard covers ALL subjects
          retention: RetentionPolicy.Limits,
          max_age: 7 * 24 * 60 * 60 * 1_000_000_000,
          storage: StorageType.File,
        });
        console.log(`[NATS] Stream ${streamName} created`);
      } else {
        throw err;
      }
    }
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
          `[NATS] Consumer ${consumerName} created for ${filterSubject}`,
        );
      } else {
        throw err;
      }
    }
  }

  // async createStream(streamName: string, subjects: string[]): Promise<void> {
  //   try {
  //     const jsm = await this.nc.jetstreamManager();
  //     await jsm.streams.add({
  //       name: streamName,
  //       subjects,
  //       retention: RetentionPolicy.Limits,
  //       max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
  //       storage: StorageType.File,
  //     });
  //     console.log(`[NATS] Stream ${streamName} created`);
  //   } catch (error: any) {
  //     if (error.message?.includes("already exists")) {
  //       console.log(`[NATS] Stream ${streamName} already exists`);
  //     } else {
  //       throw error;
  //     }
  //   }
  // }
}

export function createConsumer(nc: NatsConnection): NatsConsumer {
  return new NatsConsumer(nc);
}
