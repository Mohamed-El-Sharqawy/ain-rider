/**
 * Universal Event Envelope for NATS JetStream
 * 
 * All events published to JetStream are wrapped in this envelope
 * to provide consistent metadata for tracing, idempotency, and versioning.
 */

export interface EventEnvelope<T = unknown> {
  /** Schema version for backward compatibility (starts at 1) */
  version: number;
  
  /** Event type identifier (e.g., 'trip_requested', 'payment_processed') */
  eventType: string;
  
  /** Unique identifier for this event (UUID v4) */
  eventId: string;
  
  /** ISO 8601 timestamp when event was created */
  timestamp: string;
  
  /** W3C trace-context trace ID for distributed tracing */
  traceId: string;
  
  /** Idempotency key (same as eventId for deduplication) */
  idempotencyKey: string;
  
  /** Service that published the event (from SERVICE_NAME env var) */
  source: string;
  
  /** Event payload - type varies by eventType */
  data: T;
}

/**
 * Create an event envelope with auto-generated fields
 */
export function createEventEnvelope<T>(
  eventType: string,
  data: T,
  options: {
    eventId: string;
    traceId: string;
    source: string;
    version?: number;
  }
): EventEnvelope<T> {
  return {
    version: options.version ?? 1,
    eventType,
    eventId: options.eventId,
    timestamp: new Date().toISOString(),
    traceId: options.traceId,
    idempotencyKey: options.eventId, // Same as eventId for deduplication
    source: options.source,
    data,
  };
}
