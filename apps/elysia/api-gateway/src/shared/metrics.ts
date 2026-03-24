import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'api_gateway_' });

export const httpRequestsTotal = new Counter({
  name: 'api_gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'api_gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const proxyRequestsTotal = new Counter({
  name: 'api_gateway_proxy_requests_total',
  help: 'Total number of proxy requests to upstream services',
  labelNames: ['service', 'status'],
});

export { register };
