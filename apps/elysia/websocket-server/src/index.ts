import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { health } from './modules/health';
import { metricsPlugin } from '@ain-rider/metrics';
import { realtime } from './modules/realtime';
import { RealtimeService } from './modules/realtime/service';
import { ConnectionStore } from './shared/connections';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

RealtimeService.initNatsSubscriptions().catch((err) => {
  log('error', 'Failed to initialize NATS subscriptions', { error: String(err) });
  process.exit(1);
});

ConnectionStore.init().catch((err) => {
  log('error', 'Failed to initialize ConnectionStore Redis subscriber', { error: String(err) });
});

const app = new Elysia()
  .use(traceMiddleware)
  .use(errorHandler)
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get('origin');
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return true;
        }
        return false;
      },
      credentials: true,
    })
  )
  .use(health)
  .use(metricsPlugin({ serviceName: 'websocket-server' }))
  .use(realtime)
  .listen(PORT);

log('info', 'WebSocket Server running', { port: PORT, wsEndpoint: `ws://localhost:${PORT}/ws` });

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('info', `Received ${signal} — starting graceful shutdown`);

  try {
    await RealtimeService.stopNatsSubscriptions();
  } catch (err) {
    log('error', 'Error stopping NATS consumers during shutdown', { error: String(err) });
  }

  app.stop();
  log('info', 'WebSocket Server shut down complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
