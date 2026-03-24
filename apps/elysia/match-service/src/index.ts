import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { match } from './modules/match';
import { initNats, getConsumer } from './shared/nats';
import { MatchService } from './modules/match/service';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { TripRequestedEvent } from '@ain-rider/shared-types';
import { log } from './shared/logger';

const PORT = parseInt(process.env.MATCH_SERVICE_PORT || '3003');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

async function bootstrap() {
  await initNats();

  // Listen for trip.requested events and trigger matching
  const consumer = getConsumer();
  await consumer.subscribe<TripRequestedEvent['data']>(
    NATS_SUBJECTS.TRIP_REQUESTED,
    async (data) => {
      log('info', 'Trip request received', { tripId: data.tripId });
      await MatchService.matchDriver(data);
    }
  );

  log('info', 'NATS subscriptions ready');
}

bootstrap().catch((err) => {
  log('error', 'Bootstrap failed', { error: String(err) });
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
        info: { title: 'Match Service API', version: '1.0.0' },
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
  .use(match)
  .listen(PORT);

log('info', 'Match Service running', { port: PORT });
