/**
 * Driver availability bookkeeping: register (fresh, update-in-place, move
 * between cells, corrupt state), unregister (known, unknown, corrupt state),
 * gauge accounting, nearby lookup and the trip-flow logger fallback paths.
 */
import './helpers/env';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MatchService } from '../src/modules/match/service';
import { cache, redisCluster } from '../src/shared/redis';
import { availableDriversGauge } from '../src/shared/metrics';
import { tripLog, tripLogDump, tripLogSeparator } from '../src/shared/trip-flow-logger';
import { latLngToCell } from 'h3-js';

const CAIRO = { latitude: 30.0444, longitude: 31.2357 };

const createdDrivers: string[] = [];

async function gaugeValue(): Promise<number> {
  const g = await availableDriversGauge.get();
  return g.values.reduce((sum, v) => sum + v.value, 0);
}

async function register(driverId: string, lat: number, lng: number) {
  createdDrivers.push(driverId);
  return MatchService.registerAvailableDriver({
    driverId,
    latitude: lat,
    longitude: lng,
    vehicleTypeId: 'vt-standard',
    driverName: `Driver ${driverId}`,
    driverPhone: '+201000000000',
    driverRating: 4.5,
    vehicleMake: 'Kia',
    vehicleModel: 'Cerato',
    vehiclePlate: 'REG-001',
  });
}

async function cleanup(driverId: string) {
  await redisCluster.del(`driver:available:${driverId}`).catch(() => undefined);
  await redisCluster.del(`driver:metadata:${driverId}`).catch(() => undefined);
}

describe('registerAvailableDriver', () => {
  test('fresh registration stores driver, cell membership, metadata and bumps the gauge', async () => {
    const before = await gaugeValue();
    const { h3Index } = await register('reg-driver-fresh', CAIRO.latitude, CAIRO.longitude);
    const expectedCell = latLngToCell(CAIRO.latitude, CAIRO.longitude, 9);
    expect(h3Index).toBe(expectedCell);

    const raw = await redisCluster.get(`driver:available:reg-driver-fresh`);
    const driver = JSON.parse(raw!);
    expect(driver).toMatchObject({ driverId: 'reg-driver-fresh', h3Index: expectedCell });
    expect(driver.availableSince).toBeGreaterThan(0);

    const cellDrivers = await cache.get<any[]>(`h3:cell:${expectedCell}`);
    expect(cellDrivers.map((d) => d.driverId)).toContain('reg-driver-fresh');

    const metadata = await cache.get<any>(`driver:metadata:reg-driver-fresh`);
    expect(metadata).toMatchObject({ driverName: 'Driver reg-driver-fresh', vehiclePlate: 'REG-001' });

    expect(await gaugeValue()).toBe(before + 1);
  });

  test('re-registering the same driver must not double-count the gauge', async () => {
    await register('reg-driver-repeat', CAIRO.latitude, CAIRO.longitude);
    const afterFirst = await gaugeValue();

    // location update flow re-registers the same driver repeatedly
    await register('reg-driver-repeat', CAIRO.latitude, CAIRO.longitude);
    await register('reg-driver-repeat', CAIRO.latitude, CAIRO.longitude);

    expect(await gaugeValue()).toBe(afterFirst);
  });

  test('moving to a new cell removes the driver from the old cell', async () => {
    await register('reg-driver-move', CAIRO.latitude, CAIRO.longitude);
    const oldCell = latLngToCell(CAIRO.latitude, CAIRO.longitude, 9);

    const far = { latitude: 30.0700, longitude: 31.2800 }; // ~5km away, different cell
    await register('reg-driver-move', far.latitude, far.longitude);
    const newCell = latLngToCell(far.latitude, far.longitude, 9);
    expect(newCell).not.toBe(oldCell);

    const oldCellDrivers = (await cache.get<any[]>(`h3:cell:${oldCell}`)) ?? [];
    expect(oldCellDrivers.map((d) => d.driverId)).not.toContain('reg-driver-move');

    const newCellDrivers = await cache.get<any[]>(`h3:cell:${newCell}`);
    expect(newCellDrivers.map((d) => d.driverId)).toContain('reg-driver-move');
  });

  test('corrupt previous-driver record does not block registration', async () => {
    await redisCluster.set(`driver:available:reg-driver-corrupt1`, '{not-json', 'EX', 60);
    const { h3Index } = await register('reg-driver-corrupt1', CAIRO.latitude, CAIRO.longitude);
    const cellDrivers = await cache.get<any[]>(`h3:cell:${h3Index}`);
    expect(cellDrivers.map((d) => d.driverId)).toContain('reg-driver-corrupt1');
  });

  test('corrupt old-cell payload does not block registration', async () => {
    await register('reg-driver-corrupt2', CAIRO.latitude, CAIRO.longitude);
    const firstCell = latLngToCell(CAIRO.latitude, CAIRO.longitude, 9);
    await redisCluster.set(`h3:cell:${firstCell}`, '{bad-cell-json', 'EX', 60);

    const far = { latitude: 30.0700, longitude: 31.2800 };
    const { h3Index } = await register('reg-driver-corrupt2', far.latitude, far.longitude);
    expect(h3Index).toBe(latLngToCell(far.latitude, far.longitude, 9));
  });

  test('corrupt new-cell payload resets the cell list instead of failing', async () => {
    const cell = latLngToCell(CAIRO.latitude, CAIRO.longitude, 9);
    await redisCluster.set(`h3:cell:${cell}`, '{bad-json', 'EX', 60);

    const { h3Index } = await register('reg-driver-corrupt3', CAIRO.latitude, CAIRO.longitude);
    expect(h3Index).toBe(cell);
    const cellDrivers = await cache.get<any[]>(`h3:cell:${cell}`);
    expect(cellDrivers.map((d) => d.driverId)).toEqual(['reg-driver-corrupt3']);
  });
});

describe('unregisterDriver', () => {
  test('unknown driver is a no-op that leaves the gauge alone', async () => {
    const before = await gaugeValue();
    await MatchService.unregisterDriver('reg-driver-ghost');
    expect(await redisCluster.get(`driver:available:reg-driver-ghost`)).toBeNull();
    expect(await gaugeValue()).toBe(before);
  });

  test('unregistering removes the driver and refreshes the shared cell', async () => {
    await register('reg-driver-a', CAIRO.latitude, CAIRO.longitude);
    await register('reg-driver-b', CAIRO.latitude, CAIRO.longitude);
    const cell = latLngToCell(CAIRO.latitude, CAIRO.longitude, 9);

    await MatchService.unregisterDriver('reg-driver-a');
    expect(await redisCluster.get(`driver:available:reg-driver-a`)).toBeNull();

    const cellDrivers = await cache.get<any[]>(`h3:cell:${cell}`);
    expect(cellDrivers.map((d) => d.driverId)).toContain('reg-driver-b');
    expect(cellDrivers.map((d) => d.driverId)).not.toContain('reg-driver-a');
  });

  test('unregistering the last driver deletes the cell key', async () => {
    const solo = { latitude: 30.0800, longitude: 31.2900 }; // isolated cell
    await register('reg-driver-solo', solo.latitude, solo.longitude);
    const cell = latLngToCell(solo.latitude, solo.longitude, 9);
    expect(await cache.get<any[]>(`h3:cell:${cell}`)).not.toBeNull();

    await MatchService.unregisterDriver('reg-driver-solo');
    expect(await cache.get(`h3:cell:${cell}`)).toBeNull();
    expect(await redisCluster.get(`h3:cell:${cell}`)).toBeNull();
  });

  test('corrupt driver record hits the error path and keeps the key', async () => {
    await redisCluster.set(`driver:available:reg-driver-corrupt4`, '{oops', 'EX', 60);
    await MatchService.unregisterDriver('reg-driver-corrupt4');
    expect(await redisCluster.get(`driver:available:reg-driver-corrupt4`)).not.toBeNull();
  });

  test('corrupt cell payload hits the error path during unregister', async () => {
    await register('reg-driver-corrupt5', CAIRO.latitude, CAIRO.longitude);
    const cell = latLngToCell(CAIRO.latitude, CAIRO.longitude, 9);
    await redisCluster.set(`h3:cell:${cell}`, '{nope', 'EX', 60);

    await MatchService.unregisterDriver('reg-driver-corrupt5');
    expect(await redisCluster.get(`driver:available:reg-driver-corrupt5`)).not.toBeNull();
  });
});

describe('getNearbyDrivers', () => {
  test('returns drivers within the search rings as id/lat/lng triples', async () => {
    await register('reg-nearby-1', CAIRO.latitude, CAIRO.longitude);
    await register('reg-nearby-2', CAIRO.latitude + 0.0009, CAIRO.longitude);

    const nearby = await MatchService.getNearbyDrivers(CAIRO.latitude, CAIRO.longitude);
    const ids = nearby.map((d) => d.id);
    expect(ids).toContain('reg-nearby-1');
    expect(ids).toContain('reg-nearby-2');
    for (const d of nearby) {
      expect(d).toMatchObject({ id: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) });
    }
  });

  test('returns an empty list in the middle of nowhere', async () => {
    const nearby = await MatchService.getNearbyDrivers(-33.8611, 151.1549);
    expect(Array.isArray(nearby)).toBe(true);
  });
});

describe('cell membership moves', () => {
  test('moving from an isolated cell deletes the old cell key', async () => {
    // unique spot: no other test registers near 30.55, 31.45
    await register('reg-move-1', 30.55, 31.45);
    const oldCell = latLngToCell(30.55, 31.45, 9);

    await register('reg-move-1', 30.65, 31.55);
    const newCell = latLngToCell(30.65, 31.55, 9);

    const oldMembers = ((await cache.get(`h3:cell:${oldCell}`)) ?? []) as Array<{ driverId?: string }>;
    expect(oldMembers).toEqual([]);

    const newMembers = ((await cache.get(`h3:cell:${newCell}`)) ?? []) as Array<{ driverId?: string }>;
    expect(newMembers.some((m) => m.driverId === 'reg-move-1')).toBe(true);
  });
});

describe('trip flow logger fallbacks', () => {
  test('logging survives an unwritable log directory and dump writes entries', () => {
    const logDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs');
    const removed = existsSync(logDir);
    if (removed) rmSync(logDir, { recursive: true, force: true });
    try {
      expect(() => tripLog({ step: 'ERROR', tripId: 'logger-test', detail: 'dir removed' })).not.toThrow();
  expect(() => tripLog({ step: 'METRICS_SNAPSHOT', tripId: 'logger-test' })).not.toThrow();
      expect(() => tripLogSeparator('LOGGER TEST')).not.toThrow();
      expect(() => tripLogSeparator()).not.toThrow();
      expect(() => tripLogDump('logger-test', { ok: true })).not.toThrow();
    } finally {
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    }
  });

  test('logging writes to the log file again once the directory is back', () => {
    expect(() => tripLog({ step: 'NEARBY_DRIVERS_LOOKUP', detail: 'logger recovered' })).not.toThrow();
  });

  test('a missing log directory is recreated when the logger module loads', async () => {
    const logDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs');
    rmSync(logDir, { recursive: true, force: true });
    expect(existsSync(logDir)).toBe(false);
    try {
      vi.resetModules();
      await import('../src/shared/trip-flow-logger');
      expect(existsSync(logDir)).toBe(true);
    } finally {
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    }
  });
});

afterAll(async () => {
  for (const driverId of createdDrivers) await cleanup(driverId);
});
