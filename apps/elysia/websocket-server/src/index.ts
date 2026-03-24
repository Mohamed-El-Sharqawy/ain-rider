import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { realtime } from './modules/realtime';
import { RealtimeService } from './modules/realtime/service';
import { log } from './shared/logger';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

RealtimeService.initNatsSubscriptions().catch((err) => {
  log('error', 'Failed to initialize NATS subscriptions', { error: String(err) });
  process.exit(1);
});

new Elysia()
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
  .onError(({ code, error }) => {
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'Unhandled error', { code, message });
    return {
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString(),
    };
  })
  .use(health)
  .use(metrics)
  .use(realtime)
  .listen(PORT);

log('info', 'WebSocket Server running', { port: PORT, wsEndpoint: `ws://localhost:${PORT}/ws` });
