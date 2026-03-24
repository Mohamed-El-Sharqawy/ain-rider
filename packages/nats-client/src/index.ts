/**
 * @ain-rider/nats-client
 * 
 * NATS JetStream client utilities for ain-rider microservices
 */

// Connection
export * from './connection';

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
export { NatsPublisher } from './publisher';
export { NatsConsumer } from './consumer';
export { NatsRequester } from './requester';
export { NatsResponder } from './responder';
