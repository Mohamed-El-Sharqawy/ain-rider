/**
 * NATS Prometheus Metrics
 * 
 * Shared metrics for NATS operations across all services
 */

import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client';

// Enable default metrics with NATS prefix
collectDefaultMetrics({ prefix: 'nats_' });

// Connection metrics
export const natsConnectionsTotal = new Gauge({
  name: 'nats_connections_active',
  help: 'Number of active NATS connections',
  labelNames: ['service'],
});

export const natsConnectionErrors = new Counter({
  name: 'nats_connection_errors_total',
  help: 'Total NATS connection errors',
  labelNames: ['service'],
});

// Message metrics
export const natsMessagesPublished = new Counter({
  name: 'nats_messages_published_total',
  help: 'Total NATS messages published',
  labelNames: ['service', 'subject'],
});

export const natsMessagesReceived = new Counter({
  name: 'nats_messages_received_total',
  help: 'Total NATS messages received',
  labelNames: ['service', 'subject'],
});

export const natsMessageLatency = new Histogram({
  name: 'nats_message_latency_seconds',
  help: 'NATS message processing latency in seconds',
  labelNames: ['service', 'subject'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Request-reply metrics
export const natsRequestsTotal = new Counter({
  name: 'nats_requests_total',
  help: 'Total NATS request/reply calls',
  labelNames: ['service', 'request_type', 'status'],
});

export const natsRequestLatency = new Histogram({
  name: 'nats_request_latency_seconds',
  help: 'NATS request/reply latency in seconds',
  labelNames: ['service', 'request_type'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

// JetStream metrics
export const natsJetstreamPending = new Gauge({
  name: 'nats_jetstream_pending_messages',
  help: 'Number of pending messages in JetStream consumers',
  labelNames: ['service', 'consumer'],
});

export const natsJetstreamAckErrors = new Counter({
  name: 'nats_jetstream_ack_errors_total',
  help: 'Total JetStream message acknowledgment errors',
  labelNames: ['service', 'consumer'],
});

// DLQ metrics
export const natsDlqMessages = new Counter({
  name: 'nats_dlq_messages_total',
  help: 'Total messages sent to dead letter queue',
  labelNames: ['service', 'original_subject', 'error_type'],
});

export { register };
