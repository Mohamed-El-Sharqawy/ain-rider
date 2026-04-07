import { Elysia } from 'elysia';
import { fetchInternal } from '@ain-rider/internal-api';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://localhost:4001';
const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://localhost:3002';
const MATCH_SERVICE_URL = process.env.MATCH_SERVICE_URL || 'http://localhost:3003';
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://localhost:4003';
const WEBSOCKET_SERVER_URL = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:3001';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:4002';

const SERVICE_MAP: Record<string, string> = {
  auth: AUTH_SERVICE_URL,
  trips: TRIP_SERVICE_URL,
  location: LOCATION_SERVICE_URL,
  match: MATCH_SERVICE_URL,
  admin: ADMIN_SERVICE_URL,
  websocket: WEBSOCKET_SERVER_URL,
  payments: PAYMENT_SERVICE_URL,
};

export const metricsProxy = new Elysia()
  .get('/:service/metrics', async ({ params, set }) => {
    const targetUrl = SERVICE_MAP[params.service];
    if (!targetUrl) {
      set.status = 404;
      return { error: `Metrics for service '${params.service}' not found or mapping missing` };
    }

    try {
      const res = await fetchInternal(`${targetUrl}/metrics`, 'GET', undefined, {
        targetService: 'internal-metrics-proxy'
      });

      if (!res.ok) {
        set.status = res.status;
        return await res.text();
      }

      set.headers['Content-Type'] = res.headers.get('Content-Type') || 'text/plain';
      return await res.text();
    } catch (err) {
      set.status = 500;
      return { error: `Failed to fetch metrics from ${params.service}: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
