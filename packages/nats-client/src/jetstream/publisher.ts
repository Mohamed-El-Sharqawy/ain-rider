/**
 * JetStream Publisher
 * 
 * Base class for publishing events to NATS JetStream with:
 * - Automatic event envelope wrapping
 * - W3C trace-context headers
 * - Message ID for deduplication
 * - Structured logging
 */

import {
  NatsConnection,
  JetStreamClient,
  JetStreamPublishOptions,
  PubAck,
  headers as natsHeaders,
} from 'nats';
import { randomUUID } from 'crypto';
import { EventEnvelope, createEventEnvelope } from '../types/event-envelope';
import { generateTraceId, createTraceparent } from '../tracing';

export interface PublishOptions {
  /** Override auto-generated trace ID */
  traceId?: string;
  
  /** Override auto-generated event ID */
  eventId?: string;
  
  /** Event version (default: 1) */
  version?: number;
  
  /** Additional headers */
  headers?: Record<string, string>;
}

export class JetStreamPublisher {
  private js: JetStreamClient;
  private serviceName: string;

  constructor(
    nc: NatsConnection,
    serviceName?: string
  ) {
    this.js = nc.jetstream();
    this.serviceName = serviceName || process.env.SERVICE_NAME || 'unknown-service';
  }

  /**
   * Publish an event to JetStream with automatic envelope wrapping
   * 
   * @param subject - NATS subject (e.g., 'ain_rider.trip_requested')
   * @param eventType - Event type identifier (e.g., 'trip_requested')
   * @param data - Event payload
   * @param options - Optional publish options
   * @returns PubAck from JetStream
   */
  async publish<T>(
    subject: string,
    eventType: string,
    data: T,
    options?: PublishOptions
  ): Promise<PubAck> {
    const eventId = options?.eventId || randomUUID();
    const traceId = options?.traceId || generateTraceId();
    const version = options?.version ?? 1;

    // Create envelope
    const envelope: EventEnvelope<T> = createEventEnvelope(eventType, data, {
      eventId,
      traceId,
      source: this.serviceName,
      version,
    });

    // Create headers
    const hdrs = natsHeaders();
    
    // W3C traceparent header
    hdrs.set('traceparent', createTraceparent(traceId));
    
    // NATS message ID for deduplication
    hdrs.set('Nats-Msg-Id', eventId);
    
    // Source service
    hdrs.set('Nats-Source', this.serviceName);
    
    // Event type
    hdrs.set('Nats-Event-Type', eventType);
    
    // Additional headers
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        hdrs.set(key, value);
      }
    }

    // Publish options
    const publishOptions: Partial<JetStreamPublishOptions> = {
      headers: hdrs,
    };

    try {
      const payload = JSON.stringify(envelope);
      const ack = await this.js.publish(
        subject,
        new TextEncoder().encode(payload),
        publishOptions
      );

      console.log(
        `[JetStreamPublisher] Published to ${subject} | eventId=${eventId} | traceId=${traceId} | seq=${ack.seq}`
      );

      return ack;
    } catch (error) {
      console.error(
        `[JetStreamPublisher] Failed to publish to ${subject} | eventId=${eventId} | traceId=${traceId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   * All events share the same trace ID for correlation
   */
  async publishBatch<T>(
    events: Array<{
      subject: string;
      eventType: string;
      data: T;
    }>,
    traceId?: string
  ): Promise<PubAck[]> {
    const sharedTraceId = traceId || generateTraceId();
    
    const promises = events.map((event) =>
      this.publish(event.subject, event.eventType, event.data, {
        traceId: sharedTraceId,
      })
    );

    return Promise.all(promises);
  }
}

/**
 * Factory function to create a JetStreamPublisher
 */
export function createJetStreamPublisher(
  nc: NatsConnection,
  serviceName?: string
): JetStreamPublisher {
  return new JetStreamPublisher(nc, serviceName);
}
