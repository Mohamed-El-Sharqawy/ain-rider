/**
 * @ain-rider/nats-client
 * 
 * NATS JetStream client utilities for ain-rider microservices
 */

// Connection
export * from './connection';
export type { NatsConnection, JsMsg } from './connection';
export { getNatsServersFromEnv } from './connection';

// Types
export * from './types';

// JetStream
export * from './jetstream';

// Idempotency (also re-exports createClient and RedisClientType from redis)
export * from './idempotency';
export { createClient } from './idempotency/idempotency.service';
export type { RedisClientType } from './idempotency/idempotency.service';

// DLQ
export * from './dlq';

// Request-Reply
export * from './request-reply';

// Tracing
export * from './tracing';

// Metrics
export * from './metrics';

// Legacy exports (for backward compatibility)
export { NatsPublisher, createPublisher } from './publisher';
export { NatsConsumer, createConsumer } from './consumer';
export { NatsRequester, createRequester } from './requester';
export { NatsResponder, createResponder } from './responder';
