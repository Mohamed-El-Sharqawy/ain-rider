/**
 * Standardized Prometheus Metrics for Ain Rider
 * 
 * Provides a unified registry and common metric definitions
 * for both Elysia and NestJS services.
 */

import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

// Shared Registry
export const register = new Registry();

/**
 * Initialize metrics for the current service.
 * Enables default scrapable metrics (CPU, Memory, GC).
 */
export function initMetrics(serviceName: string, prefix?: string) {
  register.setDefaultLabels({
    service: serviceName,
    env: process.env.NODE_ENV || 'development'
  });

  collectDefaultMetrics({
    register,
    prefix: prefix || `${serviceName.replace(/-/g, '_')}_`
  });
}

/**
 * Standardized HTTP Request Metrics
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['service', 'method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Support high-scale 5ms to 10s
  registers: [register],
});

/**
 * Internal Operation Metrics (for fetchInternal)
 */
export const internalCallsTotal = new Counter({
  name: 'internal_api_calls_total',
  help: 'Total number of service-to-service internal calls',
  labelNames: ['source_service', 'target_service', 'method', 'status'],
  registers: [register],
});

/**
 * Database Metrics (Prisma)
 */
export const dbQueryDuration = new Histogram({
  name: 'prisma_query_duration_seconds',
  help: 'Duration of Prisma database queries in seconds',
  labelNames: ['service', 'model', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

export { register as promRegister };

// Framework-specific re-exports are available via sub-exports:
// '@ain-rider/metrics/nestjs' -> NestJS Module
// '@ain-rider/metrics/elysia' -> Elysia Plugin
export * from './prisma-extension';
export * from './nest-entry';
export * from './elysia-entry';