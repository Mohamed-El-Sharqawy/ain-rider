import { collectDefaultMetrics, Counter, Gauge, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'ws_server_' });

export const wsConnectionsTotal = new Gauge({
  name: 'ws_server_active_connections',
  help: 'Number of active WebSocket connections',
});

export const wsMessagesTotal = new Counter({
  name: 'ws_server_messages_total',
  help: 'Total WebSocket messages processed',
  labelNames: ['type', 'direction'],
});

export const natsEventsTotal = new Counter({
  name: 'ws_server_nats_events_total',
  help: 'Total NATS events received and fanned out',
  labelNames: ['subject'],
});

export { register };
