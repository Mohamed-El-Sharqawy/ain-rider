/**
 * JetStream Consumer Base Class
 * 
 * Abstract base class for consuming events from NATS JetStream with:
 * - Explicit ack/nak handling
 * - Automatic trace ID extraction
 * - Structured logging
 * - Graceful shutdown
 */

import {
  NatsConnection,
  JetStreamClient,
  JsMsg,
  Consumer,
} from 'nats';
import { EventEnvelope } from '../types/event-envelope';
import { extractOrGenerateTraceId } from '../tracing';
import { IdempotencyService } from '../idempotency';
import { DLQService } from '../dlq';

export interface ConsumerConfig {
  /** Stream name (e.g., 'AIN_RIDER_OPS') */
  streamName: string;
  
  /** Durable consumer name (e.g., 'trip-matched-consumer') */
  consumerName: string;
  
  /** Subject filter (e.g., 'ain_rider.trip_matched') */
  filterSubject: string;
  
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
    }
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
      this.consumer = await this.js.consumers.get(
        this.config.streamName,
        this.config.consumerName
      );

      this.running = true;
      console.log(
        `[${this.config.consumerName}] Started consuming from ${this.config.filterSubject}`
      );

      // Start the consume loop
      this.consumeLoop().catch((error) => {
        console.error(`[${this.config.consumerName}] Consume loop error:`, error);
        this.running = false;
      });
    } catch (error) {
      console.error(
        `[${this.config.consumerName}] Failed to start:`,
        error
      );
      throw error;
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
    
    try {
      // Parse envelope
      const payload = new TextDecoder().decode(msg.data);
      const envelope: EventEnvelope<unknown> = JSON.parse(payload);

      // Check idempotency
      if (this.config.enableIdempotency && this.idempotencyService) {
        const alreadyProcessed = await this.idempotencyService.isProcessed(
          this.config.consumerName,
          envelope.eventId
        );
        
        if (alreadyProcessed) {
          console.log(
            `[${this.config.consumerName}] Skipping duplicate event ${envelope.eventId} | traceId=${traceId}`
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
          envelope.eventId
        );
      }

      // Acknowledge
      msg.ack();
      
      console.log(
        `[${this.config.consumerName}] Processed ${envelope.eventType} | eventId=${envelope.eventId} | traceId=${traceId}`
      );
    } catch (error) {
      console.error(
        `[${this.config.consumerName}] Error processing message | traceId=${traceId}`,
        error
      );

      // Check if max deliveries exceeded
      const deliverCount = msg.info?.deliveryCount ?? 1;
      const maxDeliver = this.config.maxDeliver ?? 3;

      if (deliverCount >= maxDeliver) {
        // Send to DLQ
        if (this.config.enableDLQ && this.dlqService) {
          await this.sendToDLQ(msg, error, deliverCount, traceId);
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
    traceId: string
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

    let eventId = 'unknown';
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
      `[${this.config.consumerName}] Sent to DLQ | subject=${msg.subject} | eventId=${eventId} | traceId=${traceId}`
    );
  }

  /**
   * Abstract method for subclass to implement message handling
   */
  protected abstract handleMessage(
    envelope: EventEnvelope<unknown>,
    msg: JsMsg,
    traceId: string
  ): Promise<void>;
}
