import { describe, expect, test } from 'vitest';
import {
  natsConnectionErrors,
  natsConnectionsTotal,
  natsDlqMessages,
  natsJetstreamAckErrors,
  natsJetstreamPending,
  natsMessageLatency,
  natsMessagesPublished,
  natsMessagesReceived,
  natsRequestLatency,
  natsRequestsTotal,
  register,
} from '../src/metrics';

describe('nats metrics registry', () => {
  test('registers all shared nats metrics', async () => {
    const names = (await register.getMetricsAsJSON()).map((m) => m.name);
    for (const name of [
      'nats_connections_active',
      'nats_connection_errors_total',
      'nats_messages_published_total',
      'nats_messages_received_total',
      'nats_message_latency_seconds',
      'nats_requests_total',
      'nats_request_latency_seconds',
      'nats_jetstream_pending_messages',
      'nats_jetstream_ack_errors_total',
      'nats_dlq_messages_total',
    ]) {
      expect(names).toContain(name);
    }
  });

  test('counters, gauges and histograms can be recorded', async () => {
    natsConnectionsTotal.inc({ service: 'metrics-test' });
    natsConnectionsTotal.dec({ service: 'metrics-test' });
    natsConnectionErrors.inc({ service: 'metrics-test' });
    natsMessagesPublished.inc({ service: 'metrics-test', subject: 'w10.metrics' });
    natsMessagesReceived.inc({ service: 'metrics-test', subject: 'w10.metrics' });
    natsMessageLatency.observe(
      { service: 'metrics-test', subject: 'w10.metrics' },
      0.123,
    );
    natsRequestsTotal.inc({
      service: 'metrics-test',
      request_type: 'test',
      status: 'ok',
    });
    natsRequestLatency.observe({ service: 'metrics-test', request_type: 'test' }, 0.2);
    natsJetstreamPending.set({ service: 'metrics-test', consumer: 'c' }, 3);
    natsJetstreamAckErrors.inc({ service: 'metrics-test', consumer: 'c' });
    natsDlqMessages.inc({
      service: 'metrics-test',
      original_subject: 'w10.metrics',
      error_type: 'Error',
    });

    const published = await natsMessagesPublished.get();
    expect(published.values.map((v) => v.labels.service)).toContain(
      'metrics-test',
    );
    const pending = await natsJetstreamPending.get();
    expect(pending.values.map((v) => v.value)).toContain(3);
  });

  test('default node process metrics are collected with the nats prefix', async () => {
    const names = (await register.getMetricsAsJSON()).map((m) => m.name);
    expect(names.some((n) => n.startsWith('nats_'))).toBe(true);
  });
});
