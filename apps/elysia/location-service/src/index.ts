import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { location } from './modules/location';
import { initNats } from './shared/nats';
import { log } from './shared/logger';

const PORT = parseInt(process.env.LOCATION_SERVICE_PORT || '3002');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

initNats().catch((err) => {
  log('error', 'Failed to connect to NATS', { error: String(err) });
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
  .use(
    swagger({
      documentation: {
        info: { title: 'Location Service API', version: '1.0.0' },
      },
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
  .use(location)
  .listen(PORT);

log('info', 'Location Service running', { port: PORT });
