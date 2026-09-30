import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'location_service_' });

export const locationUpdatesTotal = new Counter({
  name: 'location_service_updates_total',
  help: 'Total number of location updates processed',
  labelNames: ['status'],
});

export const locationUpdateDuration = new Histogram({
  name: 'location_service_update_duration_seconds',
  help: 'Time to process a location update (Redis + TimescaleDB + NATS)',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
});

export const activeDriversGauge = new Gauge({
  name: 'location_service_active_drivers',
  help: 'Number of drivers with active location in Redis',
});

export const nearbyQueryDuration = new Histogram({
  name: 'location_service_nearby_query_duration_seconds',
  help: 'Time to execute a nearby drivers query',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
});

export { register };
