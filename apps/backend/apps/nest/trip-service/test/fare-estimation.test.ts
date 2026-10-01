/**
 * Fare estimation critical path — unit suite.
 *
 * The only system boundaries are the OSRM router and the admin-service fare
 * config HTTP endpoints; both are reached through global fetch, which is
 * stubbed per test. Expected numbers are worked literals from the fare spec:
 *
 *   fare = base (2500) + perKm (1000/km) + perMin (200/min), min 5000 EGP
 *   fallback: haversine x 1.3 detour factor, 30 km/h average speed
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripsService } from '../src/trips/trips.service';

const OSRM_URL = 'http://osrm-test:5000';
const DEFAULT_ADMIN_URL = 'http://localhost:4004';

function makeService(): TripsService {
  return new TripsService({} as any, {} as any);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface FetchPlan {
  osrm?: Response | Error;
  settings?: Response | Error;
}

/**
 * Stub global fetch with a plan per boundary. Anything unmatched returns a
 * 500 so an unexpected call fails loudly in the assertions below.
 */
function stubFetch(plan: FetchPlan): string[] {
  const urls: string[] = [];
  const fetchMock = vi.fn(async (input: any): Promise<Response> => {
    const url = String(input instanceof URL ? input.href : input);
    urls.push(url);
    const outcome = url.includes('/route/v1/driving/')
      ? plan.osrm
      : url.includes('/settings/public/fare_config')
        ? plan.settings
        : jsonResponse({ unexpected: url }, 500);
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  vi.stubGlobal('fetch', fetchMock);
  return urls;
}

beforeEach(() => {
  process.env.OSRM_URL = OSRM_URL;
  delete process.env.ADMIN_SERVICE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('estimateFare — OSRM route available', () => {
  it('computes the fare from OSRM distance and duration with default rates', async () => {
    const urls = stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5250.4, duration: 642.7 }] }),
      settings: jsonResponse({ data: {} }, 200),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result).toEqual({
      estimatedFare: 9893,
      distance: 5250,
      duration: 643,
      currency: 'EGP',
      routeSource: 'osrm',
      breakdown: { baseFare: 2500, distanceFare: 5250, timeFare: 2142 },
    });
    // OSRM URL is lng,lat ordered with pickup first, overview disabled.
    expect(urls[0]).toBe(
      `${OSRM_URL}/route/v1/driving/31.2357,30.0444;31.2089,30.0131?overview=false`,
    );
    // Fare config is read from the admin service default URL.
    expect(urls[1]).toBe(`${DEFAULT_ADMIN_URL}/settings/public/fare_config`);
  });

  it('prefers ADMIN_SERVICE_URL over the localhost default', async () => {
    process.env.ADMIN_SERVICE_URL = 'http://admin-test:1234';
    const urls = stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5250.4, duration: 642.7 }] }),
    });

    await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(urls[1]).toBe('http://admin-test:1234/settings/public/fare_config');
  });

  it('applies the minimum fare when the trip is shorter than the floor', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 100, duration: 12 }] }),
    });

    const result = await makeService().estimateFare(30.05, 31.24, 30.0501, 31.2401);

    // 2500 + 100 (0.1 km) + 40 (12 s) = 2640 -> floored to 5000
    expect(result.estimatedFare).toBe(5000);
    expect(result.routeSource).toBe('osrm');
    expect(result.breakdown).toEqual({ baseFare: 2500, distanceFare: 100, timeFare: 40 });
  });

  it('returns the base fare floor for a zero-distance, zero-duration trip', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 0, duration: 0 }] }),
    });

    const result = await makeService().estimateFare(0, 0, 0, 0);

    expect(result.estimatedFare).toBe(5000);
    expect(result.distance).toBe(0);
    expect(result.duration).toBe(0);
    expect(result.breakdown).toEqual({ baseFare: 2500, distanceFare: 0, timeFare: 0 });
  });

  it('rounds a half-unit fare component up (Math.round semantics)', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 0, duration: 1 }] }),
      settings: jsonResponse({
        data: {
          value: JSON.stringify({
            baseFare: 1000,
            perKmRate: 0,
            perMinRate: 30,
            minimumFare: 0,
          }),
        },
      }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    // 1000 + 0 + (1 s / 60) * 30 = 1000.5 -> rounds up to 1001
    expect(result.estimatedFare).toBe(1001);
    expect(result.breakdown.timeFare).toBe(1);
  });
});

describe('estimateFare — admin fare config', () => {
  it('accepts the config as a JSON string under data.value', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 10_000, duration: 600 }] }),
      settings: jsonResponse({
        data: { value: JSON.stringify({ baseFare: 1000, perKmRate: 500, perMinRate: 100, minimumFare: 3000 }) },
      }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    // 1000 + 10 km * 500 + 10 min * 100 = 7000
    expect(result.estimatedFare).toBe(7000);
    expect(result.breakdown).toEqual({ baseFare: 1000, distanceFare: 5000, timeFare: 1000 });
  });

  it('accepts the config as an object under value without a data wrapper', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 10_000, duration: 600 }] }),
      settings: jsonResponse({ value: { baseFare: 1000, perKmRate: 500, perMinRate: 100, minimumFare: 3000 } }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result.estimatedFare).toBe(7000);
  });

  it('keeps defaults for config fields that are absent (partial config)', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 10_000, duration: 600 }] }),
      settings: jsonResponse({ data: { value: { perKmRate: 250 } } }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    // 2500 + 10 km * 250 + 10 min * 200 = 7000
    expect(result.estimatedFare).toBe(7000);
    expect(result.breakdown).toEqual({ baseFare: 2500, distanceFare: 2500, timeFare: 2000 });
  });

  it('honours explicitly zero-valued config (zero base fare promo)', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5000, duration: 600 }] }),
      settings: jsonResponse({
        data: { value: { baseFare: 0, perKmRate: 0, perMinRate: 0, minimumFare: 0 } },
      }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result.estimatedFare).toBe(0);
    expect(result.breakdown).toEqual({ baseFare: 0, distanceFare: 0, timeFare: 0 });
  });

  it('falls back to default rates when the settings endpoint is not ok', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5000, duration: 600 }] }),
      settings: jsonResponse({ unavailable: true }, 503),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    // 2500 + 5 km * 1000 + 10 min * 200 = 9500
    expect(result.estimatedFare).toBe(9500);
    expect(result.breakdown.baseFare).toBe(2500);
  });

  it('falls back to default rates when the settings payload is empty', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5000, duration: 600 }] }),
      settings: jsonResponse({ data: {} }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result.estimatedFare).toBe(9500);
  });

  it('falls back to default rates when the settings value is invalid JSON', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5000, duration: 600 }] }),
      settings: jsonResponse({ data: { value: 'not-json{' } }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result.estimatedFare).toBe(9500);
  });

  it('falls back to default rates when the settings fetch throws', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [{ distance: 5000, duration: 600 }] }),
      settings: new Error('admin-service down'),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result.estimatedFare).toBe(9500);
  });
});

describe('estimateFare — haversine fallback', () => {
  it('estimates from haversine x 1.3 at 30 km/h when OSRM returns no routes', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [] }),
    });

    const result = await makeService().estimateFare(0, 0, 0, 1);

    // 1 degree of longitude at the equator = 111194.93 m; x1.3 detour:
    // distance 144553 m, 17346 s at 30 km/h,
    // fare 2500 + 144553 + 57821 = 204875 EGP
    expect(result).toEqual({
      estimatedFare: 204_875,
      distance: 144_553,
      duration: 17_346,
      currency: 'EGP',
      routeSource: 'haversine',
      breakdown: { baseFare: 2500, distanceFare: 144_553, timeFare: 57_821 },
    });
  });

  it('falls back when OSRM responds without a routes array', async () => {
    stubFetch({
      osrm: jsonResponse({ code: 'NoRoute', message: 'no route' }),
    });

    const result = await makeService().estimateFare(0, 0, 0, 1);

    expect(result.routeSource).toBe('haversine');
    expect(result.distance).toBe(144_553);
  });

  it('falls back when OSRM responds with a server error', async () => {
    stubFetch({
      osrm: jsonResponse({ error: 'boom' }, 500),
    });

    const result = await makeService().estimateFare(0, 0, 0, 1);

    expect(result.routeSource).toBe('haversine');
    expect(result.estimatedFare).toBe(204_875);
  });

  it('falls back when the OSRM fetch itself rejects (network down)', async () => {
    stubFetch({
      osrm: new Error('ECONNREFUSED'),
      settings: new Error('ECONNREFUSED'),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0131, 31.2089);

    expect(result.routeSource).toBe('haversine');
    // 4.3 km crow-flight x 1.3 -> 5632 m, 676 s, 2500 + 5632 + 2253 = 10385
    expect(result.estimatedFare).toBe(10_385);
    expect(result.distance).toBe(5632);
    expect(result.duration).toBe(676);
  });

  it('falls back locally (no OSRM call) when OSRM_URL is not configured', async () => {
    delete process.env.OSRM_URL;
    const urls = stubFetch({});

    const result = await makeService().estimateFare(0, 0, 0, 1);

    expect(urls).toEqual([
      `${DEFAULT_ADMIN_URL}/settings/public/fare_config`,
    ]); // the OSRM failure short-circuits before fetch; settings still loads
    expect(result.routeSource).toBe('haversine');
    expect(result.estimatedFare).toBe(204_875);
  });

  it('floors the haversine estimate at the minimum fare for very short trips', async () => {
    stubFetch({
      osrm: jsonResponse({ routes: [] }),
    });

    const result = await makeService().estimateFare(30.0444, 31.2357, 30.0445, 31.2357);

    // ~5.5 m crow flight x 1.3 -> far below the 5000 EGP floor
    expect(result.routeSource).toBe('haversine');
    expect(result.estimatedFare).toBe(5000);
  });
});
