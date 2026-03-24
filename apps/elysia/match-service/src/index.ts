import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { match } from './modules/match';
import { initNats, getConnection, getIdempotency } from './shared/nats';
import { MatchService } from './modules/match/service';
import { JetStreamConsumer, EventEnvelope } from '@ain-rider/nats-client';
import type { TripRequestedPayload } from '@ain-rider/nats-client';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';
import type { JsMsg } from 'nats';

const PORT = parseInt(process.env.MATCH_SERVICE_PORT || '3003');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

// JetStream consumer for trip_requested events
let tripRequestedConsumer: JetStreamConsumer;

async function bootstrap() {
  await initNats();

  // Create JetStream consumer for trip_requested events
  const nc = getConnection();
  const idempotency = getIdempotency();

  tripRequestedConsumer = new (class extends JetStreamConsumer {
    constructor() {
      super(nc, {
        streamName: 'AIN_RIDER_OPS',
        consumerName: 'trip-requested-consumer',
        filterSubject: 'ain_rider.trip_requested',
        maxDeliver: 3,
        enableIdempotency: true,
        enableDLQ: true,
      }, { idempotencyService: idempotency });
    }

    async handleMessage(
      envelope: EventEnvelope<unknown>,
      _msg: JsMsg,
      traceId: string
    ): Promise<void> {
      const payload = envelope.data as TripRequestedPayload;
      
      log('info', 'Trip request received', { 
        tripId: payload.tripId, 
        traceId 
      });

      await MatchService.matchDriver({
        tripId: payload.tripId,
        riderId: payload.riderId,
        pickupLocation: {
          latitude: payload.pickupLocation.lat,
          longitude: payload.pickupLocation.lng,
        },
        traceId,
      });
    }
  })();

  await tripRequestedConsumer.start();
  log('info', 'JetStream consumer started for trip_requested events');
}

bootstrap().catch((err) => {
  log('error', 'Bootstrap failed', { error: String(err) });
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
  .use(
    swagger({
      documentation: {
        info: { title: 'Match Service API', version: '1.0.0' },
      },
    })
  )
  .use(health)
  .use(metrics)
  .use(match)
  .listen(PORT);

log('info', 'Match Service running', { port: PORT });
