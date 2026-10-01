import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  dbQueryDuration,
  httpRequestsTotal,
  httpRequestDuration,
  initMetrics,
  internalCallsTotal,
  promRegister as register,
} from '../src';

async function sampleLabelsFor(
  metricName: string,
  service: string,
): Promise<Record<string, string | number>> {
  const metrics = await register.getMetricsAsJSON();
  const metric = metrics.find((m) => m.name === metricName);
  if (!metric) throw new Error(`metric ${metricName} not registered`);
  const value = metric.values.find((v) => v.labels.service === service);
  if (!value) throw new Error(`no sample of ${metricName} for service ${service}`);
  return value.labels as Record<string, string | number>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('standard metrics definitions', () => {
  test('registers the shared registry with the common metrics', () => {
    expect(register.getSingleMetric('http_requests_total')).toBe(httpRequestsTotal);
    expect(register.getSingleMetric('http_request_duration_seconds')).toBe(httpRequestDuration);
    expect(register.getSingleMetric('internal_api_calls_total')).toBe(internalCallsTotal);
    expect(register.getSingleMetric('prisma_query_duration_seconds')).toBe(dbQueryDuration);
  });
});

describe('initMetrics', () => {
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  test('sets service and env default labels from NODE_ENV', async () => {
    process.env.NODE_ENV = 'test';
    initMetrics('index-env-service');

    httpRequestsTotal.inc({ service: 'override', method: 'GET', route: '/x', status_code: '200' });

    const labels = await sampleLabelsFor('http_requests_total', 'override');
    expect(labels.env).toBe('test');
    expect(labels.service).toBe('override');
  });

  test('falls back to the development env label when NODE_ENV is unset', async () => {
    delete process.env.NODE_ENV;
    initMetrics('index-dev-service');

    httpRequestsTotal.inc({ service: 's', method: 'GET', route: '/x', status_code: '200' });

    const labels = await sampleLabelsFor('http_requests_total', 's');
    expect(labels.env).toBe('development');
  });

  test('derives the default-metrics prefix from the service name when no prefix is given', () => {
    initMetrics('prefix-derivation');

    expect(register.getSingleMetric('prefix_derivation_process_cpu_user_seconds_total')).toBeDefined();
  });

  test('uses an explicit prefix for the default metrics when given', () => {
    initMetrics('prefix-explicit-service', 'custom_prefix_');

    expect(register.getSingleMetric('custom_prefix_process_cpu_user_seconds_total')).toBeDefined();
  });
});
