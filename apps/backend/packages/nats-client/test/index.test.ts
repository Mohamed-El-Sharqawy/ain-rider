import { describe, expect, test } from 'vitest';
import * as pkg from '../src/index';

/**
 * The package barrel wires every module together. Importing it executes all
 * sub-barrels (dlq, idempotency, jetstream, request-reply, tracing, types)
 * and guards the public surface, including the legacy re-exports.
 */
describe('@ain-rider/nats-client public surface', () => {
  test('exports the jetstream api', () => {
    expect(pkg.JetStreamPublisher).toBeTypeOf('function');
    expect(pkg.JetStreamConsumer).toBeTypeOf('function');
    expect(pkg.StreamManager).toBeTypeOf('function');
    expect(pkg.createJetStreamPublisher).toBeTypeOf('function');
    expect(pkg.createStreamManager).toBeTypeOf('function');
  });

  test('exports the dlq and idempotency api', () => {
    expect(pkg.DLQService).toBeTypeOf('function');
    expect(pkg.DLQAlertingService).toBeTypeOf('function');
    expect(pkg.IdempotencyService).toBeTypeOf('function');
    expect(pkg.createDLQService).toBeTypeOf('function');
    expect(pkg.createDLQAlerting).toBeTypeOf('function');
    expect(pkg.createIdempotencyService).toBeTypeOf('function');
    expect(pkg.createClient).toBeTypeOf('function');
  });

  test('exports the request-reply, tracing, connection and legacy api', () => {
    expect(pkg.NatsRequestClient).toBeTypeOf('function');
    expect(pkg.NatsResponder).toBeTypeOf('function');
    expect(pkg.createNatsRequestClient).toBeTypeOf('function');
    expect(pkg.createNatsResponder).toBeTypeOf('function');
    expect(pkg.NatsRequester).toBeTypeOf('function');
    expect(pkg.createRequester).toBeTypeOf('function');
    expect(pkg.createResponder).toBeTypeOf('function');
    expect(pkg.getNatsServersFromEnv).toBeTypeOf('function');
    expect(pkg.generateTraceId).toBeTypeOf('function');
    expect(pkg.extractTraceId).toBeTypeOf('function');
    expect(pkg.createEventEnvelope).toBeTypeOf('function');
    expect(pkg.createDLQMessage).toBeTypeOf('function');
    expect(pkg.NatsPublisher).toBeTypeOf('function');
    expect(pkg.createPublisher).toBeTypeOf('function');
    expect(pkg.NatsConsumer).toBeTypeOf('function');
    expect(pkg.createConsumer).toBeTypeOf('function');
  });

  test('exports the prometheus metrics', () => {
    expect(pkg.natsMessagesPublished).toBeDefined();
    expect(pkg.natsDlqMessages).toBeDefined();
    expect(pkg.register).toBeDefined();
  });
});
