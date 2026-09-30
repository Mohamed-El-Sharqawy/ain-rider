import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'match_service_' });

export const matchAttemptsTotal = new Counter({
  name: 'match_service_attempts_total',
  help: 'Total driver-rider match attempts',
  labelNames: ['result'],
});

export const matchDuration = new Histogram({
  name: 'match_service_duration_seconds',
  help: 'Time taken to match a driver to a rider',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5],
});

export const availableDriversGauge = new Gauge({
  name: 'match_service_available_drivers',
  help: 'Approximate number of available drivers in the system',
});

export const ringExpansionsTotal = new Counter({
  name: 'match_service_ring_expansions_total',
  help: 'Times the H3 ring was expanded (k=1→k=2) due to insufficient candidates',
});

export { register };
