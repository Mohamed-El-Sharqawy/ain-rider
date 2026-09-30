import { latLngToCell, gridDisk } from 'h3-js';
import { pgPool } from '../../shared/db';
import { cache, redisCluster } from '../../shared/redis';
import { getPublisher } from '../../shared/nats';
import { LocationEventPublisher } from '../../events/location-event.publisher';
import {
  locationUpdatesTotal,
  locationUpdateDuration,
  activeDriversGauge,
} from '../../shared/metrics';
import { log } from '../../shared/logger';
import { generateTraceId } from '@ain-rider/nats-client';
import type { LocationUpdateBody, NearbyQuery } from './model';

const H3_RESOLUTION_DISPATCH = 9;
const DRIVER_LOCATION_TTL = Number(process.env.DRIVER_LOCATION_TTL) || 300;
const MAX_HISTORY_DAYS = Number(process.env.MAX_HISTORY_DAYS) || 30;

// Location event publisher for JetStream
let _locationPublisher: LocationEventPublisher | null = null;

function getLocationPublisher(): LocationEventPublisher {
  if (!_locationPublisher) {
    _locationPublisher = new LocationEventPublisher(getPublisher());
  }
  return _locationPublisher;
}

export abstract class LocationService {
  static async updateDriverLocation(body: LocationUpdateBody): Promise<{ success: boolean; h3Index: string }> {
    const end = locationUpdateDuration.startTimer();
    const { driverId, latitude, longitude, heading, speed } = body;
    const traceId = generateTraceId();

    try {
      const h3Index = latLngToCell(latitude, longitude, H3_RESOLUTION_DISPATCH);

      // Atomically update: remove old H3 cell, add to new, update position
      const prevLocation = await cache.get<{ h3Index?: string }>(`driver:location:${driverId}`);
      
      if (prevLocation?.h3Index && prevLocation.h3Index !== h3Index) {
        await redisCluster.srem(`h3:drivers:${prevLocation.h3Index}`, driverId);
      }

      await redisCluster.sadd(`h3:drivers:${h3Index}`, driverId);
      await redisCluster.setex(`driver:location:${driverId}`, DRIVER_LOCATION_TTL, JSON.stringify({ driverId, latitude, longitude, h3Index, heading, speed }));

      // Write to TimescaleDB (GPS history)
      await pgPool.query(
        `INSERT INTO driver_locations (driver_id, latitude, longitude, h3_index, heading, speed, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT DO NOTHING`,
        [driverId, latitude, longitude, h3Index, heading ?? null, speed ?? null]
      );

      // Publish location update event via JetStream
      await getLocationPublisher().publishLocationUpdate({
        driverId,
        location: { lat: latitude, lng: longitude },
        heading,
        speed,
        isOnline: true,
        h3Index,
        timestamp: new Date().toISOString(),
      }, traceId);

      locationUpdatesTotal.inc({ status: 'success' });
      return { success: true, h3Index };
    } catch (error) {
      locationUpdatesTotal.inc({ status: 'error' });
      log('error', 'Location update failed', { driverId, error: String(error) });
      throw error;
    } finally {
      end();
    }
  }

  static async getNearbyDrivers(query: NearbyQuery): Promise<{
    drivers: Array<{ driverId: string; latitude: number; longitude: number; h3Index: string }>;
    centerH3: string;
    count: number;
  }> {
    const { latitude, longitude } = query;
    const centerH3 = latLngToCell(latitude, longitude, H3_RESOLUTION_DISPATCH);
    const nearbyCells = gridDisk(centerH3, 2);

    const result = await pgPool.query<{
      driver_id: string;
      latitude: number;
      longitude: number;
      h3_index: string;
    }>(
      `SELECT DISTINCT ON (driver_id)
        driver_id, latitude, longitude, h3_index
       FROM driver_locations
       WHERE h3_index = ANY($1)
         AND recorded_at > NOW() - INTERVAL '5 minutes'
       ORDER BY driver_id, recorded_at DESC`,
      [nearbyCells]
    );

    const drivers = result.rows.map((r) => ({
      driverId: r.driver_id,
      latitude: r.latitude,
      longitude: r.longitude,
      h3Index: r.h3_index,
    }));

    activeDriversGauge.set(drivers.length);
    return { drivers, centerH3, count: drivers.length };
  }

  static async getDriverHistory(
    driverId: string,
    from: string,
    to?: string
  ): Promise<Array<{ latitude: number; longitude: number; recordedAt: Date }>> {
    const toDate = to ? new Date(to) : new Date();
    const maxFrom = new Date(toDate.getTime() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const fromDate = new Date(Math.max(new Date(from).getTime(), maxFrom.getTime()));
    const result = await pgPool.query<{
      latitude: number;
      longitude: number;
      recorded_at: Date;
    }>(
      `SELECT latitude, longitude, recorded_at
       FROM driver_locations
       WHERE driver_id = $1
         AND recorded_at BETWEEN $2 AND $3
       ORDER BY recorded_at ASC`,
      [driverId, fromDate, toDate]
    );

    return result.rows.map((r) => ({
      latitude: r.latitude,
      longitude: r.longitude,
      recordedAt: r.recorded_at,
    }));
  }
}
