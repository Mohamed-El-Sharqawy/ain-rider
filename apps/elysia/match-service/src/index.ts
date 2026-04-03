import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { match } from './modules/match';
import { initNats, getConnection, getIdempotency } from './shared/nats';
import { MatchService } from './modules/match/service';
import { JetStreamConsumer, EventEnvelope } from '@ain-rider/nats-client';
import type { TripRequestedPayload, LocationUpdatePayload } from '@ain-rider/nats-client';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';
import { cache, redisCluster } from './shared/redis';
import type { JsMsg } from 'nats';

const PORT = parseInt(process.env.MATCH_SERVICE_PORT || '3003');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

// JetStream consumers
let tripRequestedConsumer: JetStreamConsumer;
let locationUpdateConsumer: JetStreamConsumer;
let tripRejectedConsumer: JetStreamConsumer;

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
        serviceName: 'match-service',
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

      const tripRequest = {
        tripId: payload.tripId,
        riderId: payload.riderId,
        pickupLocation: {
          latitude: payload.pickupLocation.lat,
          longitude: payload.pickupLocation.lng,
        },
        traceId,
      };

      // Store in cache for re-matching on rejection
      await cache.set(`match:request:${payload.tripId}`, tripRequest, 3600);

      await MatchService.matchDriver(tripRequest);
    }
  })();

  await tripRequestedConsumer.start();
  log('info', 'JetStream consumer started for trip_requested events');

  // Consumer for location updates (automatic availability)
  locationUpdateConsumer = new (class extends JetStreamConsumer {
    constructor() {
      super(nc, {
        streamName: 'AIN_RIDER_LOCATION',
        consumerName: 'match-location-consumer',
        serviceName: 'match-service',
        filterSubject: 'ain_rider.location_updated',
      });
    }

    async handleMessage(envelope: EventEnvelope<unknown>): Promise<void> {
      const payload = envelope.data as LocationUpdatePayload;
      if (!payload.driverId) return;

      // Only register if we have metadata for them (means they are "online" and "accepting")
      const metadata = await cache.get<any>(`driver:metadata:${payload.driverId}`);
      if (metadata) {
        await MatchService.registerAvailableDriver({
          driverId: payload.driverId,
          latitude: payload.location.lat,
          longitude: payload.location.lng,
          ...metadata
        });
      }
    }
  })();
  await locationUpdateConsumer.start();

  // Consumer for trip rejections
  tripRejectedConsumer = new (class extends JetStreamConsumer {
    constructor() {
      super(nc, {
        streamName: 'AIN_RIDER_OPS',
        consumerName: 'match-rejection-consumer',
        serviceName: 'match-service',
        filterSubject: 'ain_rider.trip_rejected',
      });
    }

    async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, traceId: string): Promise<void> {
      const payload = envelope.data as { tripId: string; driverId: string; riderId: string };

      log('info', 'Trip rejection received, re-matching...', { tripId: payload.tripId, driverId: payload.driverId, traceId });

      // Add to exclusion list in Redis (TTL 10 mins for large scale)
      const key = `match:excluded:${payload.tripId}`;
      await redisCluster.sadd(key, payload.driverId);
      await redisCluster.expire(key, 600);

      // Re-trigger matching
      // We need to fetch the trip details first or use the payload
      // Since we don't have pickup location in rejection payload, we might need a cache
      // or just rely on the fact that trip_requested will be re-sent? 
      // No, we should probably store trip request in cache too.
      const tripRequest = await cache.get<any>(`match:request:${payload.tripId}`);
      if (tripRequest) {
        await MatchService.matchDriver(tripRequest);
      }
    }
  })();
  await tripRejectedConsumer.start();
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
