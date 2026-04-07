import { Elysia } from 'elysia';
import { metricsPlugin } from '@ain-rider/metrics';
import { metricsProxy } from './proxy';
import { metricsDashboard } from './dashboard';

export const metrics = new Elysia()
  .use(metricsPlugin({ serviceName: 'api-gateway' }))
  .use(metricsProxy)
  .use(metricsDashboard);

