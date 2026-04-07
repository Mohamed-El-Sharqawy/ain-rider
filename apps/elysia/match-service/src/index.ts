import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { health } from './modules/health';
import { metricsPlugin } from '@ain-rider/metrics';
import { match } from './modules/match';
import { initNats, getConnection, getIdempotency } from './shared/nats';
import { MatchService } from './modules/match/service';
import { JetStreamConsumer, EventEnvelope } from '@ain-rider/nats-client';
import type { TripRequestedPayload, LocationUpdatePayload, TripCompletedPayload } from '@ain-rider/nats-client';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';
import { cache, redisCluster } from './shared/redis';
import { tripLog, tripLogSeparator } from './shared/trip-flow-logger';
import type { JsMsg } from 'nats';

const PORT = parseInt(process.env.MATCH_SERVICE_PORT || '3003');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

// JetStream consumers
let tripRequestedConsumer: JetStreamConsumer;
let locationUpdateConsumer: JetStreamConsumer;
let tripCancelledConsumer: JetStreamConsumer;
let tripCompletedConsumer: JetStreamConsumer;

// Track active match loops to prevent duplicates
const activeMatchLoops = new Set<string>();

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

      tripLogSeparator(`NEW TRIP REQUEST: ${payload.tripId}`);
      tripLog({
        step: 'TRIP_REQUESTED', tripId: payload.tripId, detail: `rider=${payload.riderId}`, data: {
          pickup: payload.pickupLocation,
          dropoff: payload.dropoffLocation,
          pickupAddr: payload.pickupAddress,
          dropoffAddr: payload.dropoffAddress,
          fare: payload.estimatedFare,
        }
      });

      // Prevent duplicate match loops for the same trip
      if (activeMatchLoops.has(payload.tripId)) {
        tripLog({ step: 'MATCH_LOOP_SKIP_DUPLICATE', tripId: payload.tripId, detail: 'Match loop already running for this trip' });
        return;
      }

      const tripRequest = {
        tripId: payload.tripId,
        riderId: payload.riderId,
        pickupLocation: payload.pickupLocation,
        dropoffLocation: payload.dropoffLocation,
        pickupAddress: payload.pickupAddress,
        dropoffAddress: payload.dropoffAddress,
        estimatedFare: payload.estimatedFare,
        traceId,
      };

      // Store in cache for the match loop to check cancellation
      await cache.set(`match:request:${payload.tripId}`, tripRequest, 3600);

      // Spawn match loop in background so NATS message is acked immediately
      activeMatchLoops.add(payload.tripId);
      tripLog({ step: 'MATCH_LOOP_START', tripId: payload.tripId, detail: 'Spawning background match loop' });
      MatchService.matchDriver(tripRequest)
        .catch(err => {
          tripLog({ step: 'ERROR', tripId: payload.tripId, detail: `Match loop crashed: ${String(err)}` });
        })
        .finally(() => activeMatchLoops.delete(payload.tripId));
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
        filterSubject: 'ain_rider.location_update',
      });
    }

    async handleMessage(envelope: EventEnvelope<unknown>): Promise<void> {
      const payload = envelope.data as LocationUpdatePayload;
      if (!payload.driverId) return;

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

  // NOTE: tripRejectedConsumer removed — rejection is now handled inside the
  // matchDriver loop via Redis polling. Having a separate consumer caused
  // parallel match loops (BUG 3).

  // Consumer for trip cancellations
  tripCancelledConsumer = new (class extends JetStreamConsumer {
    constructor() {
      super(nc, {
        streamName: 'AIN_RIDER_OPS',
        consumerName: 'match-cancellation-consumer',
        serviceName: 'match-service',
        filterSubject: 'ain_rider.trip_cancelled',
      });
    }

    async handleMessage(envelope: EventEnvelope<unknown>): Promise<void> {
      const payload = envelope.data as { tripId: string };
      tripLog({ step: 'TRIP_CANCELLED', tripId: payload.tripId, detail: 'Cancellation received, cleaning up match state' });
      await redisCluster.set(`match:handled:${payload.tripId}`, '1', 'EX', 300);
      await cache.del(`match:request:${payload.tripId}`);
      await redisCluster.del(`match:response:${payload.tripId}`);
    }
  })();
  await tripCancelledConsumer.start();

  tripCompletedConsumer = new (class extends JetStreamConsumer {
    constructor() {
      super(nc, {
        streamName: 'AIN_RIDER_OPS',
        consumerName: 'match-trip-completed-consumer',
        serviceName: 'match-service',
        filterSubject: 'ain_rider.trip_completed',
      });
    }

    async handleMessage(envelope: EventEnvelope<unknown>): Promise<void> {
      const payload = envelope.data as TripCompletedPayload;
      tripLog({ step: 'TRIP_COMPLETED', tripId: payload.tripId, detail: 'Trip completed, ensuring all match loops are halted' });
      await redisCluster.set(`match:handled:${payload.tripId}`, '1', 'EX', 300);
      await cache.del(`match:request:${payload.tripId}`);
      await redisCluster.del(`match:response:${payload.tripId}`);
    }
  })();
  await tripCompletedConsumer.start();
  log('info', 'JetStream consumer started for trip_completed events');
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
  .use(metricsPlugin({ serviceName: 'match-service' }))
  .use(match)
  .post('/driver/respond', async ({ body, set }) => {
    const { tripId, action, driverId } = body as { tripId: string; action: string; driverId: string };
    if (action !== 'accept' && action !== 'reject') {
      set.status = 400;
      return { success: false, error: 'Invalid action' };
    }
    const value = action === 'accept' ? 'accepted' : 'rejected';
    await redisCluster.set(`match:response:${tripId}`, value, 'EX', 60);
    tripLog({ step: value === 'accepted' ? 'DRIVER_ACCEPTED' : 'DRIVER_REJECTED', tripId, driverId, detail: `TOP-LEVEL /driver/respond action=${action}` });
    return { success: true, action: value };
  })
  .listen(PORT);

log('info', 'Match Service running', { port: PORT });
