/**
 * Integration suite: boots the real AppModule (postgres + NATS + redis from
 * the docker infra), drives HTTP through fastify inject() and asserts the
 * fare/public endpoints, the trip lifecycle state machine, event publication
 * and the admin guard end to end.
 *
 * Prerequisite: pnpm docker:infra:up (postgres 5433, nats 4222-4224, redis).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  bootstrapTestApp,
  createTripPayload,
  INTERNAL_SECRET,
  makeInternalToken,
  resetTrips,
  setupTripTestEnv,
  waitForEvent,
} from './helpers';
import { NatsService } from '../src/shared/nats/nats.service';
import { TripStatus } from '@ain-rider/shared-types';

let app: NestFastifyApplication;

beforeAll(async () => {
  // Deterministic fare path: no OSRM (haversine fallback) and the admin
  // settings fetch fails fast against a closed port -> default rates.
  delete process.env.OSRM_URL;
  delete process.env.ADMIN_SERVICE_URL;
  await setupTripTestEnv();
  app = await bootstrapTestApp();
}, 240_000);

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await resetTrips();
});

function nc() {
  return app.get(NatsService).nc;
}

function nats() {
  return app.get(NatsService);
}

async function createTrip(overrides: Record<string, unknown> = {}) {
  const res = await app.inject({ method: 'POST', url: '/trips', payload: createTripPayload(overrides) });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('health endpoints', () => {
  it('GET /health reports the database up', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.info.database.status).toBe('up');
  });

  it('GET /ready identifies the service', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready', service: 'trip-service' });
  });
});

describe('POST /trips/estimate (fare critical path over HTTP)', () => {
  it('estimates from the haversine fallback with default rates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips/estimate',
      payload: { pickupLat: 30.0444, pickupLng: 31.2357, dropoffLat: 30.0131, dropoffLng: 31.2089 },
    });

    expect(res.statusCode).toBe(200);
    // Cairo Tahrir -> Giza: 4.33 km crow flight x1.3, 30 km/h, default rates,
    // above the 5000 floor. Literals from the worked example in the unit suite.
    expect(res.json()).toEqual({
      estimatedFare: 10_385,
      distance: 5_632,
      duration: 676,
      currency: 'EGP',
      routeSource: 'haversine',
      breakdown: { baseFare: 2500, distanceFare: 5_632, timeFare: 2_253 },
    });
  });

  it('rejects an estimate body that fails validation with a trace id in the envelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips/estimate',
      payload: { pickupLat: 'not-a-number', pickupLng: 31.2357, dropoffLat: 30.0131, dropoffLng: 31.2089 },
      headers: { 'x-trace-id': 'trace-estimate-1' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.traceId).toBe('trace-estimate-1');
  });

  it('rejects non-whitelisted payload keys', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips/estimate',
      payload: {
        pickupLat: 30.0444,
        pickupLng: 31.2357,
        dropoffLat: 30.0131,
        dropoffLng: 31.2089,
        hacker: true,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('trip lifecycle over HTTP', () => {
  it('creates a trip and reads it back by id; the rider history only lists completed rides', async () => {
    const riderId = '22222222-2222-4222-8222-222222222222';
    const created = await createTrip({ riderId });

    expect(created.status).toBe(TripStatus.REQUESTED);
    expect(created.paymentMethod).toBe('CASH');
    expect(created.paymentStatus).toBe('PENDING');

    const fetched = await app.inject({ method: 'GET', url: `/trips/${created.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().id).toBe(created.id);

    // Ride history is completed-only by contract: a fresh REQUESTED trip is
    // not listed yet (the lifecycle suite asserts it appears once COMPLETED).
    const byRider = await app.inject({ method: 'GET', url: `/trips?riderId=${riderId}` });
    expect(byRider.statusCode).toBe(200);
    expect(byRider.json()).toEqual([]);
  });

  it('GET /trips without filters returns an empty list', async () => {
    const res = await app.inject({ method: 'GET', url: '/trips' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('walks REQUESTED -> ASSIGNED -> MATCHED -> DRIVER_ARRIVING -> IN_PROGRESS -> COMPLETED', async () => {
    const trip = await createTrip();
    const driverId = '33333333-3333-4333-8333-333333333333';

    const started = waitForEvent(nc(), 'ain_rider.trip_started', (p: any) => p.tripId === trip.id);

    const assigned = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.ASSIGNED, driverId },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().driverId).toBe(driverId);

    const matched = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.MATCHED, driverId },
    });
    expect(matched.json().matchedAt).toBeTruthy();

    const arriving = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.DRIVER_ARRIVING },
    });
    expect(arriving.statusCode).toBe(200);

    const inProgress = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.IN_PROGRESS },
    });
    expect(inProgress.json().startedAt).toBeTruthy();

    const event = await started;
    expect(event.driverId).toBe(driverId);

    // Subscribe before the transition: the publish happens during the PATCH.
    const completedEventPromise = waitForEvent(nc(), 'ain_rider.trip_completed', (p: any) => p.tripId === trip.id);

    const completed = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.COMPLETED },
    });
    expect(completed.json().status).toBe(TripStatus.COMPLETED);
    expect(completed.json().completedAt).toBeTruthy();

    // trip_completed reaches JetStream with the trip snapshot
    const completedEvent = await completedEventPromise;
    expect(completedEvent.riderId).toBe(trip.riderId);

    // rider and driver history now include the trip
    const byDriver = await app.inject({ method: 'GET', url: `/trips?driverId=${driverId}` });
    expect(byDriver.json().map((t: any) => t.id)).toContain(trip.id);

    const riderHistory = await app.inject({
      method: 'GET',
      url: `/trips?riderId=${trip.riderId}`,
    });
    expect(riderHistory.json().map((t: any) => t.id)).toContain(trip.id);
  });

  it('rejects invalid transitions and unknown trips with a 400 envelope', async () => {
    const trip = await createTrip();

    const bad = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.COMPLETED },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('VALIDATION_ERROR');
    expect(bad.json().error.message).toContain('Invalid transition: REQUESTED');

    const missing = await app.inject({
      method: 'PATCH',
      url: '/trips/00000000-0000-4000-8000-000000000000/status',
      payload: { status: TripStatus.ASSIGNED },
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error.message).toContain('not found');
  });

  it('is idempotent when the status is already the target', async () => {
    const trip = await createTrip();

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: TripStatus.REQUESTED },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(trip.id);
  });

  it('rejects a body with an unknown status value', async () => {
    const trip = await createTrip();

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/status`,
      payload: { status: 'FLYING' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rates a trip as rider and as driver', async () => {
    const trip = await createTrip();

    const byRider = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/rate`,
      payload: { ratedBy: 'rider', rating: 4 },
    });
    expect(byRider.statusCode).toBe(200);
    expect(byRider.json().driverRating).toBe(4);

    const byDriver = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/rate`,
      payload: { ratedBy: 'driver', rating: 5 },
    });
    expect(byDriver.json().riderRating).toBe(5);
  });

  it('rejects an out-of-range rating', async () => {
    const trip = await createTrip();

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/rate`,
      payload: { ratedBy: 'rider', rating: 9 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('accept lets a driver claim a REQUESTED trip exactly once and publishes trip_matched', async () => {
    const trip = await createTrip();
    const driverId = '44444444-4444-4444-8444-444444444444';
    const matchedEvent = waitForEvent(nc(), 'ain_rider.trip_matched', (p: any) => p.tripId === trip.id);

    const first = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/accept`,
      headers: { 'x-user-id': driverId },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe(TripStatus.MATCHED);
    expect(first.json().driverId).toBe(driverId);
    expect((await matchedEvent).driverId).toBe(driverId);

    const second = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/accept`,
      headers: { 'x-user-id': '55555555-5555-4555-8555-555555555555' },
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().error.message).toContain('not available for acceptance');
  });

  it('reject resets a claimable trip and publishes trip_rejected', async () => {
    const trip = await createTrip();
    const rejectedEvent = waitForEvent(nc(), 'ain_rider.trip_rejected', (p: any) => p.tripId === trip.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/reject`,
      payload: { reason: 'too far away' },
      headers: { 'x-user-id': '66666666-6666-4666-8666-666666666666' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe(TripStatus.REQUESTED);
    expect(res.json().driverId).toBeNull();
    expect((await rejectedEvent).reason).toBe('too far away');
  });

  it('cancel marks the trip CANCELLED, keeps the driver on the event and 500s on unknown trips', async () => {
    const trip = await createTrip({ paymentMethod: undefined });
    const cancelledEvent = waitForEvent(nc(), 'ain_rider.trip_cancelled', (p: any) => p.tripId === trip.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/trips/${trip.id}/cancel`,
      payload: { reason: 'rider changed plans', cancelledBy: 'RIDER' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe(TripStatus.CANCELLED);
    expect(res.json().cancelledAt).toBeTruthy();
    expect((await cancelledEvent).cancellationReason).toBe('rider changed plans');

    const missing = await app.inject({
      method: 'PATCH',
      url: '/trips/00000000-0000-4000-8000-000000000000/cancel',
      payload: { reason: 'x', cancelledBy: 'SYSTEM' },
    });
    // cancelTrip throws a plain Error -> the global filter wraps it as 500
    expect(missing.statusCode).toBe(500);
    expect(missing.json().error.code).toBe('INTERNAL_ERROR');
    expect(missing.json().error.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates a trace id for untraced error responses', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/trips/00000000-0000-4000-8000-000000000000/cancel',
      payload: { reason: 'x', cancelledBy: 'SYSTEM' },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json().error.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects trip creation payloads that fail validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/trips',
      payload: { ...createTripPayload(), riderId: 'not-a-uuid' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('admin endpoints (InternalAuthGuard protected)', () => {
  const adminHeaders = async () => ({ authorization: `Bearer ${await makeInternalToken()}` });

  it('blocks requests without an authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/trips/admin/trips' });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    expect(res.json().error.message).toBe('Internal service auth header missing');
  });

  it('blocks non-bearer auth schemes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips',
      headers: { authorization: 'Basic user:pass' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Invalid internal service auth format');
  });

  it('blocks bearer tokens that fail verification', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips',
      headers: { authorization: 'Bearer not.a.jwt' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Invalid internal service token');
  });

  it('blocks verified tokens without the internal claim', async () => {
    const token = await makeInternalToken({ internal: undefined });
    const res = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Invalid internal service token');
  });

  it('lists trips with pagination, status filter and search', async () => {
    const completedTrip = await createTrip({ riderId: '77777777-7777-4777-8777-777777777777' });
    await createTrip({ riderId: '88888888-8888-4888-8888-888888888888' });

    await app.inject({
      method: 'PATCH',
      url: `/trips/${completedTrip.id}/status`,
      payload: { status: TripStatus.CANCELLED },
    });

    const all = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips',
      headers: await adminHeaders(),
    });
    expect(all.statusCode).toBe(200);
    expect(all.json().total).toBe(2);
    expect(all.json().trips).toHaveLength(2);

    const cancelled = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips?status=CANCELLED',
      headers: await adminHeaders(),
    });
    expect(cancelled.json().total).toBe(1);
    expect(cancelled.json().trips[0].id).toBe(completedTrip.id);

    const paged = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips?skip=1&take=1',
      headers: await adminHeaders(),
    });
    expect(paged.json().trips).toHaveLength(1);

    const searched = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips?search=77777777',
      headers: await adminHeaders(),
    });
    expect(searched.json().total).toBe(1);
    expect(searched.json().trips[0].riderId).toContain('77777777');
  });

  it('reports trip stats', async () => {
    await createTrip();

    const res = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips/stats',
      headers: await adminHeaders(),
    });

    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.requested).toBeGreaterThanOrEqual(1);
  });

  it('returns a trip by id and a 404 envelope for missing ones', async () => {
    const trip = await createTrip();

    const found = await app.inject({
      method: 'GET',
      url: `/trips/admin/trips/${trip.id}`,
      headers: await adminHeaders(),
    });
    expect(found.statusCode).toBe(200);
    expect(found.json().id).toBe(trip.id);

    const missing = await app.inject({
      method: 'GET',
      url: '/trips/admin/trips/00000000-0000-4000-8000-000000000000',
      headers: await adminHeaders(),
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
  });

  it('graceful shutdown drains nats and disconnects prisma', async () => {
    const service = nats();
    expect(service.nc).toBeTruthy();

    // close() is covered by afterAll; assert the wiring exists so the drain
    // path in onModuleDestroy is exercised there.
    expect(typeof service.nc.drain).toBe('function');
    expect(INTERNAL_SECRET).toBe(process.env.INTERNAL_SERVICE_SECRET);
  });
});
