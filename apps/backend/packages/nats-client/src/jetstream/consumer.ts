/**
 * JetStream Consumer Base Class
 *
 * Abstract base class for consuming events from NATS JetStream with:
 * - Explicit ack/nak handling
 * - Automatic trace ID extraction
 * - Structured logging
 * - Graceful shutdown
 * - Prometheus metrics
 */

import { NatsConnection, JetStreamClient, JsMsg, Consumer } from "nats";
import { EventEnvelope } from "../types/event-envelope";
import { extractOrGenerateTraceId } from "../tracing";
import { IdempotencyService } from "../idempotency";
import { DLQService } from "../dlq";
import {
  natsMessagesReceived,
  natsDlqMessages,
  natsMessageLatency,
} from "../metrics";

export interface ConsumerConfig {
  /** Stream name (e.g., 'AIN_RIDER_OPS') */
  streamName: string;

  /** Durable consumer name (e.g., 'trip-matched-consumer') */
  consumerName: string;

  /** Subject filter (e.g., 'ain_rider.trip_matched') */
  filterSubject: string;

  /** Service name for metrics (e.g., 'trip-service') */
  serviceName?: string;

  /** Maximum delivery attempts before DLQ */
  maxDeliver?: number;

  /** Enable idempotency checking */
  enableIdempotency?: boolean;

  /** Enable DLQ on failure */
  enableDLQ?: boolean;
}

export abstract class JetStreamConsumer {
  protected js: JetStreamClient;
  protected consumer: Consumer | null = null;
  protected running = false;

  private idempotencyService?: IdempotencyService;
  private dlqService?: DLQService;

  constructor(
    protected nc: NatsConnection,
    protected config: ConsumerConfig,
    services?: {
      idempotencyService?: IdempotencyService;
      dlqService?: DLQService;
    },
  ) {
    this.js = nc.jetstream();
    this.idempotencyService = services?.idempotencyService;
    this.dlqService = services?.dlqService;
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log(`[${this.config.consumerName}] Already running`);
      return;
    }

    try {
      // Ensure stream exists
      await this.ensureStream();

      // Ensure consumer exists
      await this.ensureConsumer();

      this.consumer = await this.js.consumers.get(
        this.config.streamName,
        this.config.consumerName,
      );

      this.running = true;
      console.log(
        `[${this.config.consumerName}] Started consuming from ${this.config.filterSubject}`,
      );

      // Start the consume loop
      // v8 ignore next 4 -- the consume iteration only rejects on
      // unrecoverable transport failures; deleting the stream or consumer
      // ends it cleanly, so this safety net cannot be triggered in tests.
      /* v8 ignore next 6 */
      this.consumeLoop().catch((error) => {
        console.error(
          `[${this.config.consumerName}] Consume loop error:`,
          error,
        );
        this.running = false;
      });
    } catch (error) {
      console.error(`[${this.config.consumerName}] Failed to start:`, error);
      throw error;
    }
  }

  /**
   * Ensure stream exists, create if not
   */
  private async ensureStream(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.streams.info(this.config.streamName);
      console.log(
        `[${this.config.consumerName}] Stream ${this.config.streamName} exists`,
      );
      await this.addFilterSubjectIfMissing(jsm);
    } catch {
      console.warn(
        `[${this.config.consumerName}] Stream ${this.config.streamName} not found. ` +
          `Streams should be created via StreamManager at deployment time. ` +
          `Auto-creating with subject ${this.config.filterSubject}...`,
      );
      try {
        await jsm.streams.add({
          name: this.config.streamName,
          subjects: [this.config.filterSubject],
          retention: "limits" as any,
          max_msgs: 100000,
          max_bytes: 100 * 1024 * 1024,
          storage: "file" as any,
        });
      } catch (createError: any) {
        // Stream might exist with overlapping subjects - that's fine
        if (String(createError.message).includes("overlap")) {
          console.log(
            `[${this.config.consumerName}] Stream exists with overlapping subjects, using existing`,
          );
          await this.addFilterSubjectIfMissing(jsm);
        } else {
          throw createError;
        }
      }
    }
  }

  /**
   * A stream created by another service may not cover this consumer's
   * filter subject. Publishes to uncovered subjects never receive a JetStream
   * ack, so the union of subjects must be maintained here as well.
   */
  private async addFilterSubjectIfMissing(
    jsm: Awaited<ReturnType<NatsConnection["jetstreamManager"]>>,
  ): Promise<void> {
    const info = await jsm.streams.info(this.config.streamName);
    const subjects = info.config.subjects ?? [];
    if (!subjects.includes(this.config.filterSubject)) {
      await jsm.streams.update(this.config.streamName, {
        subjects: [...subjects, this.config.filterSubject],
      });
      console.log(
        `[${this.config.consumerName}] Added subject ${this.config.filterSubject} to stream ${this.config.streamName}`,
      );
    }
  }

  /**
   * Ensure consumer exists, create if not
   */
  private async ensureConsumer(): Promise<void> {
    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.consumers.info(
        this.config.streamName,
        this.config.consumerName,
      );
      console.log(`[${this.config.consumerName}] Consumer exists`);
    } catch {
      console.log(`[${this.config.consumerName}] Creating consumer`);
      await jsm.consumers.add(this.config.streamName, {
        name: this.config.consumerName,
        durable_name: this.config.consumerName,
        filter_subject: this.config.filterSubject,
        max_deliver: this.config.maxDeliver ?? 3,
        ack_policy: "explicit" as any,
        deliver_policy: "all" as any,
      });
    }
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    this.running = false;
    console.log(`[${this.config.consumerName}] Stopped`);
  }

  /**
   * Main consume loop
   */
  private async consumeLoop(): Promise<void> {
    if (!this.consumer) return;

    const messages = await this.consumer.consume();

    for await (const msg of messages) {
      if (!this.running) break;

      await this.processMessage(msg);
    }
  }

  /**
   * Process a single message with error handling
   */
  private async processMessage(msg: JsMsg): Promise<void> {
    const traceId = extractOrGenerateTraceId(msg.headers);
    const startTime = Date.now();

    try {
      // Parse envelope
      const payload = new TextDecoder().decode(msg.data);
      const envelope: EventEnvelope<unknown> = JSON.parse(payload);

      // Record received message
      natsMessagesReceived.inc({
        service: this.config.serviceName || this.config.consumerName,
        subject: this.config.filterSubject,
      });

      // Check idempotency
      if (this.config.enableIdempotency && this.idempotencyService) {
        const alreadyProcessed = await this.idempotencyService.isProcessed(
          this.config.consumerName,
          envelope.eventId,
        );

        if (alreadyProcessed) {
          console.log(
            `[${this.config.consumerName}] Skipping duplicate event ${envelope.eventId} | traceId=${traceId}`,
          );
          msg.ack();
          return;
        }
      }

      // Delegate to subclass
      await this.handleMessage(envelope, msg, traceId);

      // Mark as processed for idempotency
      if (this.config.enableIdempotency && this.idempotencyService) {
        await this.idempotencyService.markProcessed(
          this.config.consumerName,
          envelope.eventId,
        );
      }

      // Record latency
      const latency = (Date.now() - startTime) / 1000;
      natsMessageLatency.observe(
        {
          service: this.config.serviceName || this.config.consumerName,
          subject: this.config.filterSubject,
        },
        latency,
      );

      // Acknowledge
      msg.ack();

      console.log(
        `[${this.config.consumerName}] Processed ${envelope.eventType} | eventId=${envelope.eventId} | traceId=${traceId}`,
      );
    } catch (error) {
      console.error(
        `[${this.config.consumerName}] Error processing message | traceId=${traceId}`,
        error,
      );

      // Check if max deliveries exceeded
      const deliverCount = msg.info?.deliveryCount ?? 1;
      const maxDeliver = this.config.maxDeliver ?? 3;

      if (deliverCount >= maxDeliver) {
        // Send to DLQ
        if (this.config.enableDLQ && this.dlqService) {
          await this.sendToDLQ(msg, error, deliverCount, traceId);

          // Record DLQ metric
          natsDlqMessages.inc({
            service: this.config.serviceName || this.config.consumerName,
            original_subject: this.config.filterSubject,
            // Both sides of this ternary are asserted in the tests (a plain
            // string rejection maps to UnknownError, an Error maps to its
            // name), but the v8-to-istanbul remapper emits a single branch
            // record for it that never counts.
            /* v8 ignore next */
            error_type: error instanceof Error ? error.name : "UnknownError",
          });
        }
        msg.ack(); // Ack to stop redelivery
      } else {
        // Nak for retry
        msg.nak();
      }
    }
  }

  /**
   * Send failed message to DLQ
   */
  private async sendToDLQ(
    msg: JsMsg,
    error: unknown,
    retryCount: number,
    traceId: string,
  ): Promise<void> {
    if (!this.dlqService) return;

    const payload = new TextDecoder().decode(msg.data);
    const headers: Record<string, string> = {};

    if (msg.headers) {
      for (const key of msg.headers.keys()) {
        const value = msg.headers.get(key);
        if (value) {
          headers[key] = value;
        }
      }
    }

    let eventId = "unknown";
    try {
      const envelope = JSON.parse(payload);
      eventId = envelope.eventId;
    } catch {
      // Ignore parse errors
    }

    await this.dlqService.sendToDLQ({
      originalSubject: msg.subject,
      originalPayload: payload,
      originalHeaders: headers,
      originalEventId: eventId,
      traceId,
      error: error instanceof Error ? error : new Error(String(error)),
      retryCount,
      consumerName: this.config.consumerName,
      sourceStream: this.config.streamName,
    });

    console.log(
      `[${this.config.consumerName}] Sent to DLQ | subject=${msg.subject} | eventId=${eventId} | traceId=${traceId}`,
    );
  }

  protected validateRequired(
    data: Record<string, unknown>,
    fields: string[],
    label: string,
  ): void {
    for (const field of fields) {
      if (data[field] === undefined || data[field] === null) {
        throw new Error(
          `[${this.config.consumerName}] Missing required field "${field}" in ${label}`,
        );
      }
    }
  }

  /**
   * Abstract method for subclass to implement message handling
   */
  protected abstract handleMessage(
    envelope: EventEnvelope<unknown>,
    msg: JsMsg,
    traceId: string,
  ): Promise<void>;
}
