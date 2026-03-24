/**
 * @ain-rider/nats-client
 * 
 * NATS JetStream client utilities for ain-rider microservices
 */

// Connection
export * from './connection';
export type { NatsConnection } from './connection';

// Types
export * from './types';

// JetStream
export * from './jetstream';

// Idempotency
export * from './idempotency';

// DLQ
export * from './dlq';

// Request-Reply
export * from './request-reply';

// Tracing
export * from './tracing';

// Legacy exports (for backward compatibility)
export { NatsPublisher, createPublisher } from './publisher';
export { NatsConsumer, createConsumer } from './consumer';
export { NatsRequester, createRequester } from './requester';
export { NatsResponder, createResponder } from './responder';
