import { latLngToCell, gridDisk } from 'h3-js';
import { cache } from '../../shared/redis';
import { getPublisher, getIdempotency, generateTrace } from '../../shared/nats';
import type { 
  TripMatchedPayload, 
  TripNoMatchPayload,
} from '@ain-rider/nats-client';
import {
  matchAttemptsTotal,
  matchDuration,
  availableDriversGauge,
  ringExpansionsTotal,
} from '../../shared/metrics';
import { log } from '../../shared/logger';
import type { AvailableDriver, DriverAvailableBody } from './model';

const H3_RESOLUTION = 9;
const DRIVER_TTL_SECONDS = 300; // 5 minutes
const MIN_CANDIDATES = 3;

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
    };

    // Store driver in H3 cell set
    const cellKey = `h3:cell:${h3Index}`;
    const existing = await cache.get<AvailableDriver[]>(cellKey) ?? [];
    const filtered = existing.filter((d) => d.driverId !== driverId);
    filtered.push(driver);
    await cache.set(cellKey, filtered, DRIVER_TTL_SECONDS);

    // Also store individual driver record for fast lookup
    await cache.set(`driver:available:${driverId}`, driver, DRIVER_TTL_SECONDS);

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

    try {
      // Check idempotency
      const idempotency = getIdempotency();
      const alreadyProcessed = await idempotency.isProcessed('trip-requested-consumer', tripId);
      if (alreadyProcessed) {
        log('info', 'Trip request already processed, skipping', { tripId, traceId });
        end();
        return;
      }

      const centerH3 = latLngToCell(pickupLocation.latitude, pickupLocation.longitude, H3_RESOLUTION);

      // kRing k=1 → 7 cells (center + 6 neighbors)
      let ringK = 1;
      let candidates: AvailableDriver[] = await MatchService.getCandidates(gridDisk(centerH3, ringK));

      // Expand to k=2 if fewer than MIN_CANDIDATES
      if (candidates.length < MIN_CANDIDATES) {
        ringExpansionsTotal.inc();
        ringK = 2;
        candidates = await MatchService.getCandidates(gridDisk(centerH3, ringK));
        log('info', 'Ring expanded to k=2', { tripId, candidatesFound: candidates.length });
      }

      const publisher = getPublisher();

      if (candidates.length === 0) {
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
        log('warn', 'No available drivers for trip', { tripId, riderId, ringK, traceId });
        
        // Mark as processed
        await idempotency.markProcessed('trip-requested-consumer', tripId);
        end();
        return;
      }

      // Rank by proximity (distance from center H3)
      // Simple: pick first available; production: sort by ETA, rating, acceptance rate
      const selected = candidates[0];

      // Publish trip_matched event with proper envelope
      const matchedPayload: TripMatchedPayload = {
        tripId,
        driverId: selected.driverId,
        driverName: 'Driver', // TODO: Get from driver service
        driverPhone: '+1234567890', // TODO: Get from driver service
        driverRating: 4.5, // TODO: Get from driver service
        vehicleMake: 'Toyota', // TODO: Get from driver service
        vehicleModel: 'Camry', // TODO: Get from driver service
        vehiclePlate: 'ABC123', // TODO: Get from driver service
        estimatedArrival: 300, // 5 minutes
        distance: 1000, // 1km
        matchedAt: new Date().toISOString(),
      };

      await publisher.publish(
        'ain_rider.trip_matched',
        'trip_matched',
        matchedPayload,
        { traceId }
      );

      // Remove driver from available pool
      await MatchService.unregisterDriver(selected.driverId);

      // Mark as processed
      await idempotency.markProcessed('trip-requested-consumer', tripId);

      matchAttemptsTotal.inc({ result: 'success' });
      log('info', 'Trip matched', { tripId, driverId: selected.driverId, ringK, traceId });
    } catch (error) {
      matchAttemptsTotal.inc({ result: 'error' });
      log('error', 'Match failed', { tripId, error: String(error), traceId });
      throw error;
    } finally {
      end();
    }
  }

  private static async getCandidates(cells: string[]): Promise<AvailableDriver[]> {
    const results: AvailableDriver[] = [];
    await Promise.all(
      cells.map(async (cell) => {
        const drivers = await cache.get<AvailableDriver[]>(`h3:cell:${cell}`) ?? [];
        results.push(...drivers);
      })
    );
    return results;
  }
}
