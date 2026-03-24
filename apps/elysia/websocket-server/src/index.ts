import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { realtime } from './modules/realtime';
import { RealtimeService } from './modules/realtime/service';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

RealtimeService.initNatsSubscriptions().catch((err) => {
  log('error', 'Failed to initialize NATS subscriptions', { error: String(err) });
  process.exit(1);
});

new Elysia()
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
  .use(metrics)
  .use(realtime)
  .listen(PORT);

log('info', 'WebSocket Server running', { port: PORT, wsEndpoint: `ws://localhost:${PORT}/ws` });
