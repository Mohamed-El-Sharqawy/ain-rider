import { latLngToCell, gridDisk } from 'h3-js';
import { cache, redisCluster } from '../../shared/redis';
import { getPublisher, getIdempotency, generateTrace } from '../../shared/nats';
import type { 
  TripMatchedPayload, 
  TripNoMatchPayload,
} from '@ain-rider/nats-client';
import {
  matchAttemptsTotal,
  matchDuration,
  availableDriversGauge,
} from '../../shared/metrics';
import { log } from '../../shared/logger';
import type { AvailableDriver, DriverAvailableBody } from './model';

const H3_RESOLUTION = 9;
const DRIVER_TTL_SECONDS = 300; // 5 minutes
const MAX_SEARCH_RADIUS_M = 10000; // 10km
const SEARCH_RINGS = [1, 2, 4, 8, 16, 24, 35]; // Uber-style incremental rings

function haversineDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
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

    // Store driver in H3 cell set
    const cellKey = `h3:cell:${h3Index}`;
    const existing = await cache.get<AvailableDriver[]>(cellKey) ?? [];
    const filtered = existing.filter((d) => d.driverId !== driverId);
    filtered.push(driver);
    await cache.set(cellKey, filtered, DRIVER_TTL_SECONDS);

    // Also store individual driver record for fast lookup
    await cache.set(`driver:available:${driverId}`, driver, DRIVER_TTL_SECONDS);
    
    // Store metadata for automatic re-registration via location updates
    await cache.set(`driver:metadata:${driverId}`, {
        driverName: body.driverName,
        driverPhone: body.driverPhone,
        driverRating: body.driverRating,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        vehiclePlate: body.vehiclePlate,
        vehicleTypeId: body.vehicleTypeId,
    }, 86400); // 24h metadata TTL

    availableDriversGauge.inc();
    log('info', 'Driver registered as available', { driverId, h3Index });
    return { h3Index };
  }

  static async unregisterDriver(driverId: string): Promise<void> {
    const driver = await cache.get<AvailableDriver>(`driver:available:${driverId}`);
    if (driver) {
      const cellKey = `h3:cell:${driver.h3Index}`;
      const existing = await cache.get<AvailableDriver[]>(cellKey) ?? [];
      const filtered = existing.filter((d) => d.driverId !== driverId);
      if (filtered.length > 0) {
        await cache.set(cellKey, filtered, DRIVER_TTL_SECONDS);
      } else {
        await cache.del(cellKey);
      }
      await cache.del(`driver:available:${driverId}`);
      availableDriversGauge.dec();
    }
    log('info', 'Driver unregistered', { driverId });
  }

  /**
   * Match a trip request with an available driver
   * Uses JetStream events with proper envelopes
   */
  static async matchDriver(tripRequest: {
    tripId: string;
    riderId: string;
    pickupLocation: { latitude: number; longitude: number };
    traceId?: string;
  }): Promise<void> {
    const end = matchDuration.startTimer();
    const { tripId, riderId, pickupLocation } = tripRequest;
    const traceId = tripRequest.traceId ?? generateTrace();

    const MAX_ATTEMPTS = 12; // 12 * 10s = 2 minutes total search time
    let selectedDriver: AvailableDriver | null = null;
    let finalRingK = 0;

    try {
      // Check idempotency (only for initial request)
      const idempotency = getIdempotency();
      
      const centerH3 = latLngToCell(pickupLocation.latitude, pickupLocation.longitude, H3_RESOLUTION);

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Get excluded drivers (those who rejected this trip)
        const excludedSet = await redisCluster.smembers(`match:excluded:${tripId}`) || [];
        const excludedIds = new Set(excludedSet);

        // Incremental expansion loop within this attempt
        for (const ringK of SEARCH_RINGS) {
          finalRingK = ringK;
          let candidates: AvailableDriver[] = await MatchService.getCandidates(gridDisk(centerH3, ringK));
          
          // Filter out excluded drivers and those beyond max radius
          candidates = candidates.filter(d => {
              if (excludedIds.has(d.driverId)) return false;
              const dist = haversineDistance(pickupLocation, { latitude: d.latitude, longitude: d.longitude });
              return dist <= MAX_SEARCH_RADIUS_M;
          });

          if (candidates.length > 0) {
              // Rank by proximity
              candidates.sort((a, b) => {
                  const distA = haversineDistance(pickupLocation, { latitude: a.latitude, longitude: a.longitude });
                  const distB = haversineDistance(pickupLocation, { latitude: b.latitude, longitude: b.longitude });
                  return distA - distB;
              });
              selectedDriver = candidates[0];
              log('info', `Found ${candidates.length} candidates at ring k=${ringK}`, { tripId, driverId: selectedDriver.driverId });
              break;
          }
        }

        if (selectedDriver) break;

        if (attempt < MAX_ATTEMPTS) {
          log('info', `No candidates found (Attempt ${attempt}/${MAX_ATTEMPTS}), retrying in 10s...`, { tripId });
          await new Promise(r => setTimeout(r, 10000));
        }
      }

      const publisher = getPublisher();

      if (!selectedDriver) {
        // Publish trip_no_match event
        const noMatchPayload: TripNoMatchPayload = {
          tripId,
          riderId,
          reason: 'NO_DRIVERS_AVAILABLE',
          searchedAt: new Date().toISOString(),
        };

        await publisher.publish(
          'ain_rider.trip_no_match',
          'trip_no_match',
          noMatchPayload,
          { traceId }
        );

        matchAttemptsTotal.inc({ result: 'no_drivers' });
        log('warn', 'No available drivers for trip within 10km after full search expansion and retries', { tripId, riderId, traceId });
        
        await idempotency.markProcessed('trip-requested-consumer', tripId);
        end();
        return;
      }

      // Publish trip_matched event
      const matchedPayload: TripMatchedPayload = {
        tripId,
        driverId: selectedDriver.driverId,
        driverName: selectedDriver.driverName ?? 'Driver',
        driverPhone: selectedDriver.driverPhone ?? '',
        driverRating: selectedDriver.driverRating ?? 0,
        vehicleMake: selectedDriver.vehicleMake ?? '',
        vehicleModel: selectedDriver.vehicleModel ?? '',
        vehiclePlate: selectedDriver.vehiclePlate ?? '',
        estimatedArrival: 5,
        distance: Math.round(haversineDistance(pickupLocation, { latitude: selectedDriver.latitude, longitude: selectedDriver.longitude })),
        matchedAt: new Date().toISOString(),
      };

      await publisher.publish(
        'ain_rider.trip_matched',
        'trip_matched',
        matchedPayload,
        { traceId }
      );

      // Remove driver from available pool
      await MatchService.unregisterDriver(selectedDriver.driverId);

      // Mark as processed
      await idempotency.markProcessed('trip-requested-consumer', tripId);

      matchAttemptsTotal.inc({ result: 'success' });
      log('info', 'Trip matched', { tripId, driverId: selectedDriver.driverId, ringK: finalRingK, traceId });
    } catch (error) {
      matchAttemptsTotal.inc({ result: 'error' });
      log('error', 'Match failed', { tripId, error: String(error), traceId });
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
    
    // Add logging here to debug nearby issues
    console.log(`[MatchService] Nearby lookup: lat=${lat}, lng=${lng}, cells=${cells.length}, candidates=${candidates.length}`);

    return candidates.map(c => ({
        id: c.driverId,
        lat: c.latitude,
        lng: c.longitude,
    }));
  }
}
