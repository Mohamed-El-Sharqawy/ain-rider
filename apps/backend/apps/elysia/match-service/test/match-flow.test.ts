/**
 * Matching critical path against live redis + NATS: assignment, acceptance,
 * rejection with candidate exclusion, search deadline, response timeout,
 * cancellation races, tie-breaks and location staleness.
 *
 * matchDriver is driven through its real seam: cache/NATS/redis state in,
 * published JetStream events + redis state out.
 *
 * Every test gets its own pickup coordinates: H3 ring searches reach about
 * one kilometre, so pickups spaced ~2 km apart keep candidate pools isolated.
 */
import { createServer } from 'node:http';
import './helpers/env';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { MatchService } from '../src/modules/match/service';
import { cache, redisCluster } from '../src/shared/redis';
import { ensureServiceNats, ensureStreams, EventCollector } from './helpers/nats';

const createdDrivers: string[] = [];
const createdTrips: string[] = [];

let collector: EventCollector;

function pickup(index: number): { latitude: number; longitude: number } {
  // The base sits ~6 km north of the CAIRO coords that routes/registration use:
  // leftover cell memberships there are matchable by design (staleness gap),
  // and ring-8 searches only reach ~2 km, so the pools stay isolated.
  // Tests are spaced ~4.4 km apart, beyond the ring-8 reach.
  return { latitude: 30.1 + index * 0.04, longitude: 31.2357 };
}

// Per-test pickup indices (spaced ~2 km apart)
const PICK = {
  accept: pickup(0),
  reject: pickup(1),
  nomatch: pickup(2),
  cancelWait: pickup(3),
  cancelEarly: pickup(4),
  handled: pickup(5),
  timeout: pickup(6),
  tie: pickup(7),
  stale: pickup(8),
  metaData: pickup(9),
  minimal: pickup(10),
} as const;

interface MockServer {
  url: string;
  stop: () => void;
}

async function startMockServer(handler: (req: Request) => Response): Promise<MockServer> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      });
      const out = handler(request);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      void out.arrayBuffer().then((body) => res.end(Buffer.from(body)));
    });
  });
  // node listen is async: wait for it, or address() is still null and the
  // port reads as 0
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return { url: `http://127.0.0.1:${port}`, stop: () => server.close() };
}

async function registerDriver(
  driverId: string,
  pickupPoint: { latitude: number; longitude: number },
  latOffset = 0.0009,
  profile: Record<string, unknown> = {},
): Promise<string> {
  createdDrivers.push(driverId);
  const { h3Index } = await MatchService.registerAvailableDriver({
    driverId,
    latitude: pickupPoint.latitude + latOffset,
    longitude: pickupPoint.longitude,
    vehicleTypeId: 'vt-standard',
    driverName: `Driver ${driverId}`,
    driverPhone: '+201000000000',
    driverRating: 4.8,
    vehicleMake: 'Toyota',
    vehicleModel: 'Corolla',
    vehiclePlate: 'FLOW-001',
    ...profile,
  });
  return h3Index;
}

async function seedTripRequest(
  tripId: string,
  pickupPoint: { latitude: number; longitude: number },
  riderId = 'rider-flow-1',
): Promise<void> {
  createdTrips.push(tripId);
  // clear state a previous (possibly killed) run may have left behind
  await cleanupTrip(tripId);
  await cache.set(
    `match:request:${tripId}`,
    {
      tripId,
      riderId,
      pickupLocation: { lat: pickupPoint.latitude, lng: pickupPoint.longitude },
      dropoffLocation: { lat: pickupPoint.latitude + 0.005, lng: pickupPoint.longitude + 0.004 },
      pickupAddress: 'Tahrir Square',
      dropoffAddress: 'Garden City',
      estimatedFare: 80,
      traceId: `trace-${tripId}`,
    },
    3600,
  );
}

async function cleanupTrip(tripId: string): Promise<void> {
  await cache.del(`match:request:${tripId}`).catch(() => undefined);
  for (const key of [
    `match:response:${tripId}`,
    `match:handled:${tripId}`,
    `match:excluded:${tripId}`,
    `idempotency:trip-requested-consumer:${tripId}`,
  ]) {
    await redisCluster.del(key).catch(() => undefined);
  }
}

beforeAll(async () => {
  await ensureServiceNats();
  await ensureStreams();
  collector = await EventCollector.start([
    'ain_rider.trip_assigned',
    'ain_rider.trip_matched',
    'ain_rider.trip_no_match',
  ]);
}, 30000);

afterAll(async () => {
  for (const driverId of createdDrivers) {
    await MatchService.unregisterDriver(driverId).catch(() => undefined);
    await redisCluster.del(`driver:metadata:${driverId}`).catch(() => undefined);
  }
  for (const tripId of createdTrips) await cleanupTrip(tripId);
  await collector?.stop();
});

test('accepted driver: publishes assigned then matched, unregisters driver, finalizes trip state', async () => {
  const tripId = 'flow-accept-1';
  const rider = { firstName: 'Laila', lastName: 'Hassan', phoneNumber: '+201234567890', rating: 4.7 };
  const auth = await startMockServer(() => Response.json(rider));
  const osrm = await startMockServer(() => Response.json({ code: 'Ok', routes: [{ distance: 1234, duration: 600 }] }));
  process.env.AUTH_SERVICE_URL = auth.url;
  process.env.OSRM_URL = osrm.url;

  try {
    await registerDriver('flow-accept-driver-1', PICK.accept);
    await seedTripRequest(tripId, PICK.accept);

    const done = MatchService.matchDriver({
      tripId,
      riderId: 'rider-flow-1',
      pickupLocation: { lat: PICK.accept.latitude, lng: PICK.accept.longitude },
      dropoffLocation: { lat: PICK.accept.latitude + 0.005, lng: PICK.accept.longitude + 0.004 },
      pickupAddress: 'Tahrir Square',
      dropoffAddress: 'Garden City',
      estimatedFare: 80,
    });

    const assigned = await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
    expect(assigned.eventType).toBe('trip_assigned');
    expect(assigned.data).toMatchObject({
      tripId,
      driverId: 'flow-accept-driver-1',
      driverName: 'Driver flow-accept-driver-1',
      driverPhone: '+201000000000',
      driverRating: 4.8,
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehiclePlate: 'FLOW-001',
      distance: 1234,
      estimatedDuration: 600,
      estimatedArrival: 10,
      riderName: 'Laila Hassan',
      riderPhone: '+201234567890',
      riderRating: 4.7,
      riderId: 'rider-flow-1',
      pickupAddress: 'Tahrir Square',
      dropoffAddress: 'Garden City',
      estimatedFare: 80,
      pickupLocation: { lat: PICK.accept.latitude, lng: PICK.accept.longitude },
      dropoffLocation: { lat: PICK.accept.latitude + 0.005, lng: PICK.accept.longitude + 0.004 },
    });
    expect(typeof assigned.data.matchedAt).toBe('string');

    await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
    await done;

    const matched = await collector.waitFor('ain_rider.trip_matched', (d) => d.tripId === tripId);
    expect(matched.data.driverId).toBe('flow-accept-driver-1');

    // driver removed from the pool
    expect(await redisCluster.get(`driver:available:flow-accept-driver-1`)).toBeNull();

    // trip lifecycle keys finalized
    expect(await redisCluster.exists(`match:handled:${tripId}`)).toBe(1);
    expect(await cache.get(`match:request:${tripId}`)).toBeNull();
    expect(await redisCluster.get(`match:response:${tripId}`)).toBeNull();
    expect(await redisCluster.exists(`match:excluded:${tripId}`)).toBe(0);
    expect(await redisCluster.exists(`driver:assignment:pending:flow-accept-driver-1`)).toBe(0);
    expect(await redisCluster.exists(`idempotency:trip-requested-consumer:${tripId}`)).toBe(1);
  } finally {
    auth.stop();
    osrm.stop();
  }
}, 30000);

test('explicit rejection excludes the driver and the next-closest candidate is matched', async () => {
  const tripId = 'flow-reject-1';
  const auth = await startMockServer(() => new Response('nope', { status: 500 })); // rider metadata unavailable
  const osrm = await startMockServer(() => new Response('osrm down', { status: 500 })); // OSRM unavailable
  process.env.AUTH_SERVICE_URL = auth.url;
  process.env.OSRM_URL = osrm.url;

  try {
    await registerDriver('flow-reject-near', PICK.reject, 0.0009); // ~100m
    await registerDriver('flow-reject-far', PICK.reject, 0.0027); // ~300m
    await seedTripRequest(tripId, PICK.reject, 'rider-flow-2');

    const done = MatchService.matchDriver({
      tripId,
      riderId: 'rider-flow-2',
      pickupLocation: { lat: PICK.reject.latitude, lng: PICK.reject.longitude },
    });

    const first = await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
    expect(first.data.driverId).toBe('flow-reject-near');
    // haversine fallback was used because OSRM answered 500
    expect(first.data.distance).toBeGreaterThan(50);
    expect(first.data.distance).toBeLessThan(150);

    await redisCluster.set(`match:response:${tripId}`, 'rejected', 'EX', 60);

    const second = await collector.waitFor(
      'ain_rider.trip_assigned',
      (d) => d.tripId === tripId && d.driverId === 'flow-reject-far',
    );
    expect(second.data.driverId).toBe('flow-reject-far');
    expect(second.data.distance).toBeGreaterThan(250);
    expect(second.data.distance).toBeLessThan(350);
    expect(second.data.riderName).toBe('Rider'); // rider metadata unavailable
    expect(second.data.riderRating).toBe(5.0);

    await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
    await done;

    // rejecting driver stays available (only acceptance removes from the pool)
    expect(await redisCluster.get(`driver:available:flow-reject-near`)).not.toBeNull();
    expect(await redisCluster.get(`driver:available:flow-reject-far`)).toBeNull();

    const matched = await collector.waitFor('ain_rider.trip_matched', (d) => d.tripId === tripId);
    expect(matched.data.driverId).toBe('flow-reject-far');
  } finally {
    auth.stop();
    osrm.stop();
  }
}, 30000);

test('no drivers available: search deadline hits and trip_no_match SEARCH_TIMEOUT is published', async () => {
  const tripId = 'flow-nomatch-1';
  await seedTripRequest(tripId, PICK.nomatch, 'rider-flow-3');

  await MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-3',
    pickupLocation: { lat: PICK.nomatch.latitude, lng: PICK.nomatch.longitude },
  });

  const noMatch = await collector.waitFor('ain_rider.trip_no_match', (d) => d.tripId === tripId);
  expect(noMatch.data).toMatchObject({
    tripId,
    riderId: 'rider-flow-3',
    reason: 'SEARCH_TIMEOUT',
  });
  expect(typeof noMatch.data.searchedAt).toBe('string');

  expect(await cache.get(`match:request:${tripId}`)).toBeNull();
}, 30000);

test('cancellation while waiting for the driver response stops the loop and removes the pending assignment', async () => {
  const tripId = 'flow-cancel-wait-1';
  await registerDriver('flow-cancel-driver-1', PICK.cancelWait);
  await seedTripRequest(tripId, PICK.cancelWait, 'rider-flow-4');

  const done = MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-4',
    pickupLocation: { lat: PICK.cancelWait.latitude, lng: PICK.cancelWait.longitude },
  });

  await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
  await cache.del(`match:request:${tripId}`); // rider cancelled
  await done;

  await collector.expectNone('ain_rider.trip_matched', (d) => d.tripId === tripId, 800);
  expect(await cache.get(`match:request:${tripId}`)).toBeNull();
  // the pending assignment cache must not leak after cancellation
  expect(await redisCluster.exists(`driver:assignment:pending:flow-cancel-driver-1`)).toBe(0);
}, 30000);

test('cancellation before the search starts exits without publishing anything', async () => {
  const tripId = 'flow-cancel-early-1';
  await registerDriver('flow-cancel-driver-2', PICK.cancelEarly);
  await seedTripRequest(tripId, PICK.cancelEarly, 'rider-flow-5');

  const done = MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-5',
    pickupLocation: { lat: PICK.cancelEarly.latitude, lng: PICK.cancelEarly.longitude },
  });
  await cache.del(`match:request:${tripId}`); // cancel immediately
  await done;

  for (const subject of ['ain_rider.trip_assigned', 'ain_rider.trip_matched', 'ain_rider.trip_no_match']) {
    await collector.expectNone(subject, (d) => d.tripId === tripId, 800);
  }
}, 30000);

test('trip already handled by another loop exits without publishing', async () => {
  const tripId = 'flow-handled-1';
  await registerDriver('flow-handled-driver-1', PICK.handled);
  await seedTripRequest(tripId, PICK.handled, 'rider-flow-6');
  await redisCluster.set(`match:handled:${tripId}`, '1', 'EX', 300);

  await MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-6',
    pickupLocation: { lat: PICK.handled.latitude, lng: PICK.handled.longitude },
  });

  for (const subject of ['ain_rider.trip_assigned', 'ain_rider.trip_matched']) {
    await collector.expectNone(subject, (d) => d.tripId === tripId, 800);
  }

  // the loop must not clear someone else's handled marker
  expect(await redisCluster.exists(`match:handled:${tripId}`)).toBe(1);
}, 30000);

test('driver response timeout retries the same driver, then the deadline produces no_match', async () => {
  const tripId = 'flow-timeout-1';
  await registerDriver('flow-timeout-driver-1', PICK.timeout);
  await seedTripRequest(tripId, PICK.timeout, 'rider-flow-7');

  // no auth/osrm endpoints configured: the module's default URLs must be used,
  // and the rider-metadata fetch must tolerate a missing internal secret
  const savedAuth = process.env.AUTH_SERVICE_URL;
  const savedOsrm = process.env.OSRM_URL;
  const savedSecret = process.env.INTERNAL_SERVICE_SECRET;
  delete process.env.AUTH_SERVICE_URL;
  delete process.env.OSRM_URL;
  delete process.env.INTERNAL_SERVICE_SECRET;
  try {
    await MatchService.matchDriver({
      tripId,
      riderId: 'rider-flow-7',
      pickupLocation: { lat: PICK.timeout.latitude, lng: PICK.timeout.longitude },
    });
  } finally {
    if (savedAuth !== undefined) process.env.AUTH_SERVICE_URL = savedAuth;
    if (savedOsrm !== undefined) process.env.OSRM_URL = savedOsrm;
    if (savedSecret !== undefined) process.env.INTERNAL_SERVICE_SECRET = savedSecret;
  }

  const assignments = collector.countFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
  expect(assignments).toBeGreaterThanOrEqual(2);

  const noMatch = await collector.waitFor('ain_rider.trip_no_match', (d) => d.tripId === tripId);
  expect(noMatch.data.reason).toBe('SEARCH_TIMEOUT');

  // timeouts never exclude a driver
  expect(await redisCluster.exists(`match:excluded:${tripId}`)).toBe(0);
  // the unresponsive driver stays available
  expect(await redisCluster.get(`driver:available:flow-timeout-driver-1`)).not.toBeNull();
}, 30000);

test('equidistant candidates resolve deterministically across runs', async () => {
  const winners: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const tripId = `flow-tie-trip-${i}`;
    // identical coordinates => identical haversine distance => tie
    await registerDriver(`flow-tie-${i}-a`, PICK.tie, 0);
    await registerDriver(`flow-tie-${i}-b`, PICK.tie, 0);

    await seedTripRequest(tripId, PICK.tie, 'rider-flow-8');
    const done = MatchService.matchDriver({
      tripId,
      riderId: 'rider-flow-8',
      pickupLocation: { lat: PICK.tie.latitude, lng: PICK.tie.longitude },
    });
    const assigned = await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
    winners.push(assigned.data.driverId);
    await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
    await done;
    await cleanupTrip(tripId);
    // remove both drivers so the next iteration's candidate pool holds only
    // its own equidistant pair (the winner was already unregistered by the
    // accept flow; redis set order is undefined so the loser must go too)
    await MatchService.unregisterDriver(`flow-tie-${i}-a`).catch(() => undefined);
    await MatchService.unregisterDriver(`flow-tie-${i}-b`).catch(() => undefined);
  }

  expect(winners[0]).toBe('flow-tie-1-a');
  expect(winners[1]).toBe('flow-tie-2-a');
  expect(winners[2]).toBe('flow-tie-3-a');
}, 40000);

test('a driver whose availability record expired but whose cell entry lives on is still matched (staleness gap)', async () => {
  const tripId = 'flow-stale-1';
  await registerDriver('flow-stale-driver-1', PICK.stale);
  // simulate the record expiring while the cell membership key outlives it
  await redisCluster.del(`driver:available:flow-stale-driver-1`);

  await seedTripRequest(tripId, PICK.stale, 'rider-flow-9');
  const done = MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-9',
    pickupLocation: { lat: PICK.stale.latitude, lng: PICK.stale.longitude },
  });

  await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
  await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
  await done;

  const matched = await collector.waitFor('ain_rider.trip_matched', (d) => d.tripId === tripId);
  expect(matched.data.driverId).toBe('flow-stale-driver-1');
}, 30000);

test('corrupt driver metadata falls back to placeholder identity fields', async () => {
  const tripId = 'flow-corrupt-meta-1';
  const auth = await startMockServer(() => new Response('auth down', { status: 500 }));
  const osrm = await startMockServer(() => new Response('osrm down', { status: 500 }));
  process.env.AUTH_SERVICE_URL = auth.url;
  process.env.OSRM_URL = osrm.url;

  try {
    const h3Index = await registerDriver('flow-meta-driver-1', PICK.metaData);
    // the candidate pool reads full records from the H3 cell set: replace
    // this driver's member record with one that has no identity fields
    const members = ((await cache.get(`h3:cell:${h3Index}`)) ?? []) as Array<Record<string, unknown>>;
    const patched = members.map((m) =>
      m.driverId === 'flow-meta-driver-1'
        ? {
            driverId: 'flow-meta-driver-1',
            latitude: PICK.metaData.latitude + 0.0009,
            longitude: PICK.metaData.longitude,
          }
        : m,
    );
    expect(patched).not.toEqual(members);
    await cache.set(`h3:cell:${h3Index}`, patched, 300);
    await seedTripRequest(tripId, PICK.metaData, 'rider-flow-10');

    const done = MatchService.matchDriver({
      tripId,
      riderId: 'rider-flow-10',
      pickupLocation: { lat: PICK.metaData.latitude, lng: PICK.metaData.longitude },
    });

    const assigned = await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
    expect(assigned.data).toMatchObject({
      driverId: 'flow-meta-driver-1',
      driverName: 'Driver',
      driverPhone: '',
      driverRating: 0,
      vehicleMake: '',
      vehicleModel: '',
      vehiclePlate: '',
    });

    await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
    await done;
  } finally {
    auth.stop();
    osrm.stop();
  }
}, 30000);

test('latitude-form pickup and absent dropoff fall back cleanly', async () => {
  const tripId = 'flow-minimal-1';
  const auth = await startMockServer(() => new Response('auth down', { status: 500 }));
  const osrm = await startMockServer(() => new Response('osrm down', { status: 500 }));
  process.env.AUTH_SERVICE_URL = auth.url;
  process.env.OSRM_URL = osrm.url;

  try {
    await registerDriver('flow-minimal-driver-1', PICK.minimal);
    createdTrips.push(tripId);
    await cleanupTrip(tripId);
    // latitude/longitude form, latitude-form dropoff, empty rider id, empty address, zero fare
    await cache.set(
      `match:request:${tripId}`,
      {
        tripId,
        riderId: '',
        pickupLocation: { latitude: PICK.minimal.latitude, longitude: PICK.minimal.longitude },
        dropoffLocation: { latitude: PICK.minimal.latitude + 0.005, longitude: PICK.minimal.longitude + 0.004 },
        pickupAddress: 'Minimal Pickup',
        dropoffAddress: '',
        estimatedFare: 0,
      },
      3600,
    );

    const done = MatchService.matchDriver({
      tripId,
      riderId: '',
      pickupLocation: { latitude: PICK.minimal.latitude, longitude: PICK.minimal.longitude } as any,
      dropoffLocation: {
        latitude: PICK.minimal.latitude + 0.005,
        longitude: PICK.minimal.longitude + 0.004,
      },
      dropoffAddress: '',
      estimatedFare: 0,
    } as any);

    const assigned = await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
    // the assigned event always emits the normalized lat/lng form
    expect(assigned.data.pickupLocation).toEqual({
      lat: PICK.minimal.latitude,
      lng: PICK.minimal.longitude,
    });
    expect(assigned.data.dropoffLocation).toEqual({
      lat: PICK.minimal.latitude + 0.005,
      lng: PICK.minimal.longitude + 0.004,
    });
    expect(assigned.data.dropoffAddress).toBe('');
    expect(assigned.data.estimatedFare).toBe(0);
    expect(assigned.data.riderId).toBe('');
    expect(assigned.data.distance).toBeGreaterThan(0); // haversine fallback ran

    await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
    await done;
  } finally {
    auth.stop();
    osrm.stop();
  }
}, 30000);

test('a trip request with an empty pickup location searches and times out safely', async () => {
  const tripId = 'flow-empty-pickup-1';
  await seedTripRequest(tripId, PICK.minimal, 'rider-flow-12');
  // overwrite the seed with a pickup location that carries no coordinates
  await cache.set(
    `match:request:${tripId}`,
    { tripId, riderId: 'rider-flow-12', pickupLocation: {} } as any,
    3600,
  );

  await MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-12',
    pickupLocation: {} as any,
  });

  const noMatch = await collector.waitFor('ain_rider.trip_no_match', (d) => d.tripId === tripId);
  expect(noMatch.data.reason).toBe('SEARCH_TIMEOUT');
}, 30000);

test('location objects with no coordinates default to zero in the assigned payload', async () => {
  const tripId = 'flow-zero-locs-1';
  createdTrips.push(tripId);
  await cleanupTrip(tripId);
  await registerDriver('flow-zero-driver-1', { latitude: 0.001, longitude: 0.001 });
  await cache.set(
    `match:request:${tripId}`,
    { tripId, riderId: 'rider-flow-13', pickupLocation: {}, dropoffLocation: {} } as any,
    3600,
  );

  const done = MatchService.matchDriver({
    tripId,
    riderId: 'rider-flow-13',
    pickupLocation: {} as any,
    dropoffLocation: {} as any,
  } as any);

  const assigned = await collector.waitFor('ain_rider.trip_assigned', (d) => d.tripId === tripId);
  expect(assigned.data.pickupLocation).toEqual({ lat: 0, lng: 0 });
  expect(assigned.data.dropoffLocation).toEqual({ lat: 0, lng: 0 });

  await redisCluster.set(`match:response:${tripId}`, 'accepted', 'EX', 60);
  await done;
  const matched = await collector.waitFor('ain_rider.trip_matched', (d) => d.tripId === tripId);
  expect(matched.data.driverId).toBe('flow-zero-driver-1');
}, 30000);
