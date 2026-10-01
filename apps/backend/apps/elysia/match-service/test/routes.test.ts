/**
 * HTTP route suite: /driver/available, /driver/unavailable, /driver/respond,
 * /driver/nearby, /driver/debug, plus validation and error-handler paths.
 * Boots the real app (trace + error handler + match plugin) and uses
 * app.handle(), mirroring how the service runs.
 */
import './helpers/env';
import { Elysia } from 'elysia';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buildApp, internalAuthHeaders, post, signInternalToken } from './helpers/app';
import { MatchService } from '../src/modules/match/service';
import { cache, redisCluster } from '../src/shared/redis';
import { traceMiddleware } from '../src/shared/trace';
import { errorHandler } from '../src/shared/error-handler';

const app = buildApp();

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };

const createdDrivers: string[] = [];
const createdTrips: string[] = [];

async function registerDriver(
  driverId: string,
  lat: number,
  lng: number,
): Promise<string> {
  createdDrivers.push(driverId);
  const { h3Index } = await MatchService.registerAvailableDriver({
    driverId,
    latitude: lat,
    longitude: lng,
    vehicleTypeId: 'vt-standard',
    driverName: `Driver ${driverId}`,
    driverPhone: '+201000000000',
    driverRating: 4.8,
    vehicleMake: 'Toyota',
    vehicleModel: 'Corolla',
    vehiclePlate: 'ABC-123',
  });
  return h3Index;
}

function trackTrip(tripId: string): string {
  createdTrips.push(tripId);
  return tripId;
}

beforeAll(async () => {
  delete process.env.DEBUG_PROD_CHECK;
});

test('GET /ready reports redis connectivity', async () => {
  const res = await app.handle(new Request('http://localhost/ready'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ready', redis: 'ok' });
});

test('POST /driver/available registers a driver and stores cell + metadata', async () => {
  const res = await post(
    app,
    '/driver/available',
    {
      driverId: 'route-driver-1',
      latitude: CAIRO.latitude,
      longitude: CAIRO.longitude,
      vehicleTypeId: 'vt-standard',
      driverName: 'Driver route-driver-1',
      driverPhone: '+201000000000',
      driverRating: 4.8,
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehiclePlate: 'ABC-123',
    },
    internalAuthHeaders('gw'),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  const h3Index = body.h3Index;
  expect(h3Index).toMatch(/^[0-9a-f]+$/);

  const raw = await redisCluster.get(`driver:available:route-driver-1`);
  expect(raw).not.toBeNull();
  const driver = JSON.parse(raw!);
  expect(driver).toMatchObject({
    driverId: 'route-driver-1',
    latitude: CAIRO.latitude,
    h3Index,
  });

  const cellDrivers = await cache.get<any[]>(`h3:cell:${h3Index}`);
  expect(cellDrivers.map((d) => d.driverId)).toContain('route-driver-1');

  const metadata = await cache.get<any>(`driver:metadata:route-driver-1`);
  expect(metadata).toMatchObject({ driverName: 'Driver route-driver-1', vehicleTypeId: 'vt-standard' });
});

test('POST /driver/available rejects an invalid body with the unified 400 envelope', async () => {
  const res = await post(app, '/driver/available', { driverId: 'x' }, internalAuthHeaders('gw'));
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(json.error.code).toBe('VALIDATION_ERROR');
  expect(json.error.message).toBe('Validation failed');
  expect(json.error.details.validation).toContain('Expected number');
});

test('POST /driver/available rejects out-of-range coordinates', async () => {
  const res = await post(
    app,
    '/driver/available',
    { driverId: 'route-driver-bad', latitude: 95, longitude: 31, vehicleTypeId: 'vt' },
    internalAuthHeaders('gw'),
  );
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
});

test('POST /driver/unavailable unregisters a driver', async () => {
  await registerDriver('route-driver-gone', CAIRO.latitude + 0.0009, CAIRO.longitude);
  const res = await post(app, '/driver/unavailable', { driverId: 'route-driver-gone' }, internalAuthHeaders('gw'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
  expect(await redisCluster.get(`driver:available:route-driver-gone`)).toBeNull();
});

test('POST /driver/respond rejects mismatched driverId with 403', async () => {
  const token = await signInternalToken({ internal: true, sub: 'route-driver-1' });
  const res = await post(
    app,
    '/driver/respond',
    { tripId: 'route-trip-1', action: 'accept', driverId: 'route-driver-2' },
    { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  );
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ success: false, error: 'Driver ID does not match authenticated user.' });
});

test('POST /driver/respond rejects invalid action with 400', async () => {
  const res = await post(
    app,
    '/driver/respond',
    { tripId: 'route-trip-1', action: 'maybe', driverId: 'route-driver-1' },
    internalAuthHeaders('route-driver-1'),
  );
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ success: false });
});

test('POST /driver/respond accept stores accepted in redis', { retry: 2 }, async () => {
  const tripId = trackTrip('route-trip-accept');
  const res = await post(
    app,
    '/driver/respond',
    { tripId, action: 'accept', driverId: 'route-driver-1' },
    internalAuthHeaders('route-driver-1'),
  );
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(200);
  expect(body).toEqual({ success: true, action: 'accepted' });
  expect(await redisCluster.get(`match:response:${tripId}`)).toBe('accepted');
});

test('POST /driver/respond reject stores rejected in redis', async () => {
  const tripId = trackTrip('route-trip-reject');
  const res = await post(
    app,
    '/driver/respond',
    { tripId, action: 'reject', driverId: 'route-driver-1' },
    internalAuthHeaders('route-driver-1'),
  );
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(200);
  expect(body).toEqual({ success: true, action: 'rejected' });
  expect(await redisCluster.get(`match:response:${tripId}`)).toBe('rejected');
});

test('POST /driver/respond with malformed body returns the unified 400 envelope', async () => {
  const res = await post(app, '/driver/respond', { tripId: 'x' }, internalAuthHeaders('route-driver-1'));
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
});

test('GET /driver/nearby returns registered drivers', async () => {
  await registerDriver('route-driver-2', CAIRO.latitude + 0.0009, CAIRO.longitude);
  const res = await app.handle(
    new Request('http://localhost/driver/nearby?latitude=30.0444&longitude=31.2357', {
      headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
    }),
  );
  expect(res.status).toBe(200);
  const drivers = await res.json();
  const ids = drivers.map((d: any) => d.id);
  expect(ids).toContain('route-driver-1');
  expect(ids).toContain('route-driver-2');
  for (const d of drivers) {
    expect(d).toMatchObject({ id: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) });
  }
});

test('GET /driver/nearby rejects non-numeric coordinates with 400', async () => {
  const res = await app.handle(
    new Request('http://localhost/driver/nearby?latitude=abc&longitude=31.2', {
      headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
    }),
  );
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: expect.stringContaining('Invalid coordinates') });
});

test('GET /driver/nearby rejects out-of-range coordinates with 400', async () => {
  const res = await app.handle(
    new Request('http://localhost/driver/nearby?latitude=999&longitude=31.2', {
      headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
    }),
  );
  expect(res.status).toBe(400);
});

test('GET /driver/nearby requires query params (unified 400 envelope)', async () => {
  const res = await app.handle(
    new Request('http://localhost/driver/nearby', {
      headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
    }),
  );
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
});

test('GET /driver/debug lists registered drivers, active requests and idempotency keys', async () => {
  // Seed state that the debug scan must see regardless of cluster slot.
  await registerDriver('route-debug-driver-a', CAIRO.latitude, CAIRO.longitude);
  await registerDriver('route-debug-driver-b', CAIRO.latitude + 0.01, CAIRO.longitude);
  const tripId = trackTrip('route-debug-trip');
  await cache.set(`match:request:${tripId}`, { tripId, riderId: 'rider-debug' }, 300);
  await redisCluster.set(`idempotency:trip-requested-consumer:${tripId}`, '1', 'EX', 300);

  const res = await app.handle(
    new Request('http://localhost/driver/debug', {
      headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  const driverIds = body.registeredDrivers.map((d: any) => d.driverId);
  expect(driverIds).toContain('route-debug-driver-a');
  expect(driverIds).toContain('route-debug-driver-b');
  expect(body.activeMatchRequests.map((r: any) => r.key)).toContain(`match:request:${tripId}`);
  expect(body.idempotencyKeys.some((k: string) => k.includes(tripId))).toBe(true);
  expect(typeof body.timestamp).toBe('string');
});

test('GET /driver/debug skips unparsable records without failing', async () => {
  // a corrupt availability record must not break the listing
  await redisCluster.set('driver:available:route-corrupt-1', 'not-json{{{', 'EX', 300);
  try {
    const res = await app.handle(
      new Request('http://localhost/driver/debug', {
        headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registeredDrivers.map((d: any) => d.driverId)).not.toContain('route-corrupt-1');
  } finally {
    await redisCluster.del('driver:available:route-corrupt-1');
  }
});

test('GET /driver/debug returns 404 in production', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await app.handle(
      new Request('http://localhost/driver/debug', {
        headers: { 'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET! },
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('an incoming x-trace-id header is reused as the trace id', async () => {
  // validation errors fire before the trace derive runs, so the middleware
  // is exercised directly on a probe app
  const traced = new Elysia().use(traceMiddleware).get('/t', ({ traceId }) => ({ traceId }));

  const withHeader = await traced.handle(new Request('http://localhost/t', { headers: { 'x-trace-id': 'route-trace-incoming-1' } }));
  expect(await withHeader.json()).toEqual({ traceId: 'route-trace-incoming-1' });

  const withoutHeader = await traced.handle(new Request('http://localhost/t'));
  const generated = (await withoutHeader.json()) as { traceId: string };
  expect(generated.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('the error handler maps an unknown throw to the 500 envelope', async () => {
  // no production route throws a bare Error through HTTP, so the fallback
  // arm of the handler is exercised on a probe app
  const boom = new Elysia().use(errorHandler).get('/boom', () => {
    throw new Error('plain failure');
  });
  const res = await boom.handle(new Request('http://localhost/boom'));
  expect(res.status).toBe(500);
  const json = (await res.json()) as { success: boolean; error: { code: string } };
  expect(json.success).toBe(false);
  expect(json.error.code).toBe('INTERNAL_ERROR');
});

afterAll(async () => {
  for (const driverId of createdDrivers) {
    await redisCluster.del(`driver:available:${driverId}`).catch(() => undefined);
    await redisCluster.del(`driver:metadata:${driverId}`).catch(() => undefined);
  }
  for (const tripId of createdTrips) {
    await cache.del(`match:request:${tripId}`).catch(() => undefined);
    await redisCluster.del(`match:response:${tripId}`).catch(() => undefined);
    await redisCluster.del(`match:handled:${tripId}`).catch(() => undefined);
    await redisCluster.del(`idempotency:trip-requested-consumer:${tripId}`).catch(() => undefined);
  }
});