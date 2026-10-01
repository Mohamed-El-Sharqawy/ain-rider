import { latLngToCell, gridDisk } from 'h3-js';
import { cache, redisCluster } from '../../shared/redis';
import { getPublisher, getIdempotency, generateTrace } from '../../shared/nats';
import type { 
  TripMatchedPayload, 
  TripNoMatchPayload,
} from '@ain-rider/nats-client';
import { haversineDistance } from '@ain-rider/shared-types';
import {
  matchAttemptsTotal,
  matchDuration,
  availableDriversGauge,
} from '../../shared/metrics';
import { log } from '../../shared/logger';
import { tripLog } from '../../shared/trip-flow-logger';
import type { AvailableDriver, DriverAvailableBody } from './model';

const H3_RESOLUTION = Number(process.env.H3_RESOLUTION) || 9;
const DRIVER_TTL_SECONDS = Number(process.env.DRIVER_TTL_SECONDS) || 300;
/* v8 ignore next 2 -- config defaults; helpers/env.ts always sets both */
const MAX_SEARCH_RADIUS_M = Number(process.env.MAX_SEARCH_RADIUS_M) || 10000;
const SEARCH_RINGS = (process.env.SEARCH_RINGS?.split(',').map(Number).filter(n => n > 0)) || [1, 2, 4, 8, 16, 24, 35];
/* v8 ignore next 3 -- config defaults; helpers/env.ts always sets all three */
const DRIVER_RESPONSE_TIMEOUT_S = Number(process.env.DRIVER_RESPONSE_TIMEOUT_S) || 30;
const DRIVER_RESPONSE_POLL_MS = Number(process.env.DRIVER_RESPONSE_POLL_MS) || 1000;
const MAX_SEARCH_TIME_S = Number(process.env.MAX_SEARCH_TIME_S) || 600;

function normalizeCoords(
  point: { latitude?: number; longitude?: number; lat?: number; lng?: number },
): { latitude: number; longitude: number } {
  return {
  /* v8 ignore next 2 -- callers always pass latitude-form points */
  latitude: point.latitude ?? point.lat ?? 0,
  longitude: point.longitude ?? point.lng ?? 0,
};
}

function computeDistance(
  a: { latitude?: number; longitude?: number; lat?: number; lng?: number },
  b: { latitude?: number; longitude?: number; lat?: number; lng?: number },
): number {
  return haversineDistance(normalizeCoords(a), normalizeCoords(b));
}

export abstract class MatchService {
  static async registerAvailableDriver(body: DriverAvailableBody): Promise<{ h3Index: string }> {
    const { driverId, latitude, longitude, vehicleTypeId } = body;
    const h3Index = latLngToCell(latitude, longitude, H3_RESOLUTION);

    const driver: AvailableDriver = {
      driverId,
      latitude,
      longitude,
      vehicleTypeId,
      h3Index,
      availableSince: Date.now(),
      driverName: body.driverName,
      driverPhone: body.driverPhone,
      driverRating: body.driverRating,
      vehicleMake: body.vehicleMake,
      vehicleModel: body.vehicleModel,
      vehiclePlate: body.vehiclePlate,
    };

    const driverKey = `driver:available:${driverId}`;
    const newCellKey = `h3:cell:${h3Index}`;
    
    // Check for previous location to cleanup old cell
    const prevJson = await redisCluster.get(driverKey);
    if (prevJson) {
      try {
        const prev = JSON.parse(prevJson);
        if (prev.h3Index !== h3Index) {
          const oldCellKey = `h3:cell:${prev.h3Index}`;
          const oldCellData = await redisCluster.get(oldCellKey);
          if (oldCellData) {
            const oldDrivers = JSON.parse(oldCellData);
            const filtered = oldDrivers.filter((d: any) => d.driverId !== driverId);
            if (filtered.length > 0) {
              await redisCluster.set(oldCellKey, JSON.stringify(filtered), 'EX', DRIVER_TTL_SECONDS);
            } else {
              await redisCluster.del(oldCellKey);
            }
          }
        }
      } catch (e) {
        log('warn', 'Failed to cleanup old driver cell', { driverId, error: String(e) });
      }
    }

    // Update new cell
    const cellData = await redisCluster.get(newCellKey);
    let cellDrivers: any[] = [];
    if (cellData) {
      try {
        cellDrivers = JSON.parse(cellData);
      } catch {
        cellDrivers = [];
      }
    }
    
    // Upsert driver in cell list
    const updated = cellDrivers.filter((d: any) => d.driverId !== driverId);
    updated.push(driver);
    
    await redisCluster.set(newCellKey, JSON.stringify(updated), 'EX', DRIVER_TTL_SECONDS);
    await redisCluster.set(driverKey, JSON.stringify(driver), 'EX', DRIVER_TTL_SECONDS);

    await cache.set(`driver:metadata:${driverId}`, {
        driverName: body.driverName,
        driverPhone: body.driverPhone,
        driverRating: body.driverRating,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        vehiclePlate: body.vehiclePlate,
        vehicleTypeId: body.vehicleTypeId,
    }, 86400);

    // Only a driver that was not available before grows the gauge;
    // re-registrations (location updates) must not double-count.
    if (!prevJson) {
      availableDriversGauge.inc();
    }
    tripLog({ step: 'DRIVER_REGISTERED', driverId, detail: `h3=${h3Index} lat=${latitude} lng=${longitude}`, data: {
      name: body.driverName, vehicle: `${body.vehicleMake} ${body.vehicleModel}`, plate: body.vehiclePlate,
    }});
    return { h3Index };
  }

  static async asyncUnregisterDriver(driverId: string): Promise<void> {
    const driverKey = `driver:available:${driverId}`;
    const driverJson = await redisCluster.get(driverKey);
    
    if (!driverJson) {
      tripLog({ step: 'DRIVER_UNREGISTERED', driverId, detail: 'no record found' });
      return;
    }

    try {
      const driver = JSON.parse(driverJson);
      const cellKey = `h3:cell:${driver.h3Index}`;
      const cellData = await redisCluster.get(cellKey);
      
      if (cellData) {
        const drivers = JSON.parse(cellData);
        const filtered = drivers.filter((d: any) => d.driverId !== driverId);
        if (filtered.length > 0) {
          await redisCluster.set(cellKey, JSON.stringify(filtered), 'EX', DRIVER_TTL_SECONDS);
        } else {
          await redisCluster.del(cellKey);
        }
      }
      
      await redisCluster.del(driverKey);
      availableDriversGauge.dec();
      tripLog({ step: 'DRIVER_UNREGISTERED', driverId, detail: 'removed successfully' });
    } catch (e) {
      log('error', 'Failed to unregister driver', { driverId, error: String(e) });
    }
  }

  static async unregisterDriver(driverId: string): Promise<void> {
    return MatchService.asyncUnregisterDriver(driverId);
  }

  /**
   * Match a trip request with an available driver
   * Uses JetStream events with proper envelopes
   */
  static async matchDriver(tripRequest: {
    tripId: string;
    riderId: string;
    pickupLocation: { latitude?: number; longitude?: number; lat?: number; lng?: number };
    dropoffLocation?: { latitude?: number; longitude?: number; lat?: number; lng?: number };
    pickupAddress?: string;
    dropoffAddress?: string;
    estimatedFare?: number;
    traceId?: string;
  }): Promise<void> {
    const end = matchDuration.startTimer();
    const { tripId, riderId } = tripRequest;
    const pickupLocation = {
      latitude: tripRequest.pickupLocation.latitude ?? tripRequest.pickupLocation.lat ?? 0,
      longitude: tripRequest.pickupLocation.longitude ?? tripRequest.pickupLocation.lng ?? 0,
    };
    const traceId = tripRequest.traceId ?? generateTrace();

    let selectedDriver: AvailableDriver | null = null;
    let finalRingK = 0;

    try {
      const idempotency = getIdempotency();
      const publisher = getPublisher();
      const centerH3 = latLngToCell(pickupLocation.latitude, pickupLocation.longitude, H3_RESOLUTION);

      // ── NEW: Fetch rider metadata ──
      const riderInfo = await MatchService.fetchRiderMetadata(riderId);

      let matched = false;
      let attempt = 1;
      const searchDeadline = Date.now() + MAX_SEARCH_TIME_S * 1000;

      tripLog({ step: 'DRIVER_SEARCH_START', tripId, detail: `centerH3=${centerH3} pickup=(${pickupLocation.latitude},${pickupLocation.longitude}) deadline=${MAX_SEARCH_TIME_S}s` });

      while (!matched) {
        if (Date.now() > searchDeadline) {
          tripLog({ step: 'SEARCH_DEADLINE_HIT', tripId, detail: `Exhausted after ${attempt} attempts, publishing trip_no_match` });
          const noMatchPayload: TripNoMatchPayload = {
            tripId,
            riderId,
            reason: 'SEARCH_TIMEOUT',
            searchedAt: new Date().toISOString(),
          };
          await publisher.publish('ain_rider.trip_no_match', 'trip_no_match', noMatchPayload, { traceId });
          tripLog({ step: 'NATS_PUBLISH', tripId, detail: 'Published trip_no_match' });
          matchAttemptsTotal.inc({ result: 'no_match' });
          await cache.del(`match:request:${tripId}`);
          return;
        }

        const stillActive = await cache.get(`match:request:${tripId}`);
        const handled = await redisCluster.exists(`match:handled:${tripId}`);

        if (stillActive === null || handled) {
          await new Promise(r => setTimeout(r, 500));
          const recheck = await cache.get(`match:request:${tripId}`);
          const recheckHandled = await redisCluster.exists(`match:handled:${tripId}`);

          if (recheck === null || recheckHandled) {
            tripLog({ step: 'MATCH_LOOP_EXIT', tripId, detail: handled ? 'Trip already handled by another loop' : 'Trip no longer in cache' });
            return;
          }
        }

        /* v8 ignore next -- smembers always resolves to an array */
        const excludedSet = await redisCluster.smembers(`match:excluded:${tripId}`) || [];
        const excludedIds = new Set(excludedSet);
        tripLog({ step: 'DRIVER_SEARCH_RING', tripId, detail: `Attempt #${attempt}, excluded=${excludedSet.length} drivers`, data: { excludedIds: excludedSet } });

        selectedDriver = null;
        for (const ringK of SEARCH_RINGS) {
          finalRingK = ringK;
          const cells = gridDisk(centerH3, ringK);
          let allRaw: AvailableDriver[] = await MatchService.getCandidates(cells);
          const beforeFilter = allRaw.length;
          let candidates = allRaw.filter(d => {
            if (excludedIds.has(d.driverId)) return false;
            const dist = computeDistance(pickupLocation, { latitude: d.latitude, longitude: d.longitude });
            return dist <= MAX_SEARCH_RADIUS_M;
          });

          if (beforeFilter > 0 || ringK <= 2) {
            tripLog({ step: 'DRIVER_SEARCH_CANDIDATES', tripId, detail: `ring=${ringK} cells=${cells.length} raw=${beforeFilter} filtered=${candidates.length}`, data: {
              rawDrivers: allRaw.map(d => ({ id: d.driverId.substring(0,8), lat: d.latitude, lng: d.longitude, dist: Math.round(computeDistance(pickupLocation, {latitude: d.latitude, longitude: d.longitude})) })),
            }});
          }

          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              const distA = computeDistance(pickupLocation, { latitude: a.latitude, longitude: a.longitude });
              const distB = computeDistance(pickupLocation, { latitude: b.latitude, longitude: b.longitude });
              return distA - distB;
            });
            selectedDriver = candidates[0];
            const dist = Math.round(computeDistance(pickupLocation, { latitude: selectedDriver.latitude, longitude: selectedDriver.longitude }));
            tripLog({ step: 'DRIVER_SEARCH_CANDIDATES', tripId, driverId: selectedDriver.driverId,
              detail: `SELECTED closest of ${candidates.length} at ring=${ringK}, dist=${dist}m` });
            break;
          }
        }

        if (!selectedDriver) {
          tripLog({ step: 'DRIVER_SEARCH_NO_CANDIDATES', tripId, detail: `Attempt #${attempt} found nothing across all rings, retrying in 5s...` });
          await new Promise(r => setTimeout(r, 5000));
          attempt++;
          continue;
        }

        // ── Driver found: calculate OSRM distance and send assignment ──
        const osrmData = await MatchService.getOSRMDistance(
          { lat: selectedDriver.latitude, lng: selectedDriver.longitude },
          { lat: pickupLocation.latitude, lng: pickupLocation.longitude }
        );
        const finalDistance = osrmData?.distance ?? Math.round(computeDistance(pickupLocation, { latitude: selectedDriver.latitude, longitude: selectedDriver.longitude }));
        const finalDuration = osrmData?.duration ?? Math.round(finalDistance / 1000 / 30 * 3600);

        const assignPayload: TripMatchedPayload = {
          tripId,
          driverId: selectedDriver.driverId,
          driverName: selectedDriver.driverName ?? 'Driver',
          driverPhone: selectedDriver.driverPhone ?? '',
          driverRating: selectedDriver.driverRating ?? 0,
          vehicleMake: selectedDriver.vehicleMake ?? '',
          vehicleModel: selectedDriver.vehicleModel ?? '',
          vehiclePlate: selectedDriver.vehiclePlate ?? '',
          estimatedArrival: Math.max(1, Math.round(finalDuration / 60)),
          estimatedDuration: finalDuration,
          distance: finalDistance,
          riderName: riderInfo ? `${riderInfo.firstName} ${riderInfo.lastName}` : 'Rider',
          riderPhone: riderInfo?.phoneNumber || '',
          riderRating: riderInfo?.rating ?? 5.0,
          matchedAt: new Date().toISOString(),
          pickupLocation: {
            lat: tripRequest.pickupLocation.latitude ?? tripRequest.pickupLocation.lat ?? 0,
            lng: tripRequest.pickupLocation.longitude ?? tripRequest.pickupLocation.lng ?? 0,
          },
          dropoffLocation: tripRequest.dropoffLocation ? {
            lat: tripRequest.dropoffLocation.latitude ?? tripRequest.dropoffLocation.lat ?? 0,
            lng: tripRequest.dropoffLocation.longitude ?? tripRequest.dropoffLocation.lng ?? 0,
          } : undefined,
          pickupAddress: tripRequest.pickupAddress || '',
          dropoffAddress: tripRequest.dropoffAddress || '',
          estimatedFare: tripRequest.estimatedFare || 0,
          riderId: tripRequest.riderId || '',
        };

        await redisCluster.del(`match:response:${tripId}`);
        await publisher.publish('ain_rider.trip_assigned', 'trip_assigned', assignPayload, { traceId });
        
        // Cache assignment for state-sync (WebSocket reconnection)
        await redisCluster.set(
          `driver:assignment:pending:${selectedDriver.driverId}`,
          JSON.stringify(assignPayload),
          'EX',
          DRIVER_RESPONSE_TIMEOUT_S + 5 // Buffer
        );

        tripLog({ step: 'DRIVER_ASSIGNED', tripId, driverId: selectedDriver.driverId,
          detail: `Published trip_assigned, waiting up to ${DRIVER_RESPONSE_TIMEOUT_S}s for response...`,
          data: { distance: assignPayload.distance, pickup: assignPayload.pickupAddress, dropoff: assignPayload.dropoffAddress },
        });

        // Poll Redis for driver response (accept/reject) up to DRIVER_RESPONSE_TIMEOUT_S
        // Also respect the overall search deadline
        const responseDeadline = Math.min(
          Date.now() + DRIVER_RESPONSE_TIMEOUT_S * 1000,
          searchDeadline,
        );
        let response: string | null = null;

        try {
          while (Date.now() < responseDeadline) {
            response = await redisCluster.get(`match:response:${tripId}`);
            if (response) break;
            // Also check if trip was cancelled while waiting
            const active = await cache.get(`match:request:${tripId}`);
            if (active === null) {
              await new Promise(r => setTimeout(r, 300));
              const recheck = await cache.get(`match:request:${tripId}`);
              if (recheck === null) {
                log('info', 'Trip cancelled while waiting for driver response', { tripId });
                return;
              }
            }
            await new Promise(r => setTimeout(r, DRIVER_RESPONSE_POLL_MS));
          }
        } finally {
          // Remove pending assignment cache on every exit path, including
          // cancellation, so the driver's pending state never leaks.
          await redisCluster.del(`driver:assignment:pending:${selectedDriver.driverId}`);
        }

        if (response === 'accepted') {
          tripLog({ step: 'DRIVER_ACCEPTED', tripId, driverId: selectedDriver.driverId, detail: 'Driver accepted! Publishing trip_matched to rider' });
          await publisher.publish('ain_rider.trip_matched', 'trip_matched', assignPayload, { traceId });
          tripLog({ step: 'TRIP_MATCHED', tripId, driverId: selectedDriver.driverId, detail: `Published trip_matched | ring=${finalRingK} | attempts=${attempt}` });
          await MatchService.unregisterDriver(selectedDriver.driverId);
          await redisCluster.set(`match:handled:${tripId}`, '1', 'EX', 3600);
          await cache.del(`match:request:${tripId}`);
          await idempotency.markProcessed('trip-requested-consumer', tripId);
          await redisCluster.del(`match:response:${tripId}`);
          await redisCluster.del(`match:excluded:${tripId}`);
          matched = true;
          matchAttemptsTotal.inc({ result: 'success' });
        } else if (response === 'rejected') {
          // Only exclude on explicit reject — timeout might be API/network issue
          tripLog({ step: 'DRIVER_REJECTED', tripId, driverId: selectedDriver.driverId,
            detail: 'Driver explicitly rejected, excluding and finding next driver' });
          await redisCluster.sadd(`match:excluded:${tripId}`, selectedDriver.driverId);
          await redisCluster.expire(`match:excluded:${tripId}`, 600);
          await redisCluster.del(`match:response:${tripId}`);
          attempt++;
        } else {
          // Timeout — don't exclude, the driver may retry (API could have failed)
          tripLog({ step: 'DRIVER_TIMEOUT', tripId, driverId: selectedDriver.driverId,
            detail: `Driver timed out after ${DRIVER_RESPONSE_TIMEOUT_S}s, will retry same driver` });
          await redisCluster.del(`match:response:${tripId}`);
          attempt++;
        }
      }
    } catch (error) {
      matchAttemptsTotal.inc({ result: 'error' });
      tripLog({ step: 'ERROR', tripId, detail: `Match failed: ${String(error)}` });
      throw error;
    } finally {
      end();
    }
  }

  private static async getCandidates(cells: string[]): Promise<AvailableDriver[]> {
    const uniqueDrivers = new Map<string, AvailableDriver>();

    await Promise.all(
      cells.map(async (cell) => {
        const drivers = await cache.get<AvailableDriver[]>(`h3:cell:${cell}`) ?? [];
        drivers.forEach(d => {
            if (!uniqueDrivers.has(d.driverId)) {
                uniqueDrivers.set(d.driverId, d);
            }
        });
      })
    );
    return Array.from(uniqueDrivers.values());
  }

  static async getNearbyDrivers(lat: number, lng: number): Promise<Array<{ id: string; lat: number; lng: number }>> {
    const centerH3 = latLngToCell(lat, lng, H3_RESOLUTION);
    const cells = gridDisk(centerH3, 4); // Increased to ~3.5km for better visualization
    const candidates = await MatchService.getCandidates(cells);
    
    tripLog({ step: 'NEARBY_DRIVERS_LOOKUP', detail: `lat=${lat}, lng=${lng}, cells=${cells.length}, candidates=${candidates.length}` });

    return candidates.map(c => ({
        id: c.driverId,
        lat: c.latitude,
        lng: c.longitude,
    }));
  }

  private static async fetchRiderMetadata(riderId: string) {
    const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
    const secret = process.env.INTERNAL_SERVICE_SECRET;
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/internal/users/${riderId}/basic`, {
        headers: { 'x-internal-secret': secret || '' }
      });
      if (res.ok) return await res.json() as { firstName: string; lastName: string; phoneNumber: string; rating: number };
    } catch (e) {
      log('warn', 'Failed to fetch rider info', { riderId, error: String(e) });
    }
    return null;
  }

  private static async getOSRMDistance(origin: { lat: number, lng: number }, destination: { lat: number, lng: number }) {
    const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${OSRM_URL}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.routes?.[0]) return { distance: Math.round(data.routes[0].distance), duration: Math.round(data.routes[0].duration) };
      }
    } catch (e) {
      log('warn', 'OSRM distance fetch failed', { origin, destination, error: String(e) });
    }
    return null;
  }
}
