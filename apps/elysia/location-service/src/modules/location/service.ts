import { latLngToCell } from 'h3-js';
import { pgPool } from '../../shared/db';
import { cache, redisCluster } from '../../shared/redis';
import { getPublisher } from '../../shared/nats';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { LocationUpdate } from '@ain-rider/shared-types';
import {
  locationUpdatesTotal,
  locationUpdateDuration,
  activeDriversGauge,
} from '../../shared/metrics';
import { log } from '../../shared/logger';
import type { LocationUpdateBody, NearbyQuery } from './model';

const H3_RESOLUTION_DISPATCH = 9;

export abstract class LocationService {
  static async updateDriverLocation(body: LocationUpdateBody): Promise<{ success: boolean; h3Index: string }> {
    const end = locationUpdateDuration.startTimer();
    const { driverId, latitude, longitude, heading, speed } = body;

    try {
      const h3Index = latLngToCell(latitude, longitude, H3_RESOLUTION_DISPATCH);

      const locationUpdate: LocationUpdate = {
        driverId,
        location: { latitude, longitude, timestamp: new Date(), heading, speed },
        h3Index,
      };

      // Atomically update: remove old H3 cell, add to new, update position
      const prevLocation = await cache.get<LocationUpdate>(`driver:location:${driverId}`);
      const pipeline = redisCluster.pipeline();

      if (prevLocation?.h3Index && prevLocation.h3Index !== h3Index) {
        pipeline.srem(`h3:drivers:${prevLocation.h3Index}`, driverId);
      }

      pipeline.sadd(`h3:drivers:${h3Index}`, driverId);
      pipeline.setex(`driver:location:${driverId}`, 300, JSON.stringify(locationUpdate));
      await pipeline.exec();

      // Write to TimescaleDB (GPS history)
      await pgPool.query(
        `INSERT INTO driver_locations (driver_id, latitude, longitude, h3_index, heading, speed, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [driverId, latitude, longitude, h3Index, heading ?? null, speed ?? null]
      );

      // Publish NATS event for WebSocket fanout
      await getPublisher().publish({
        subject: NATS_SUBJECTS.LOCATION_UPDATE,
        data: locationUpdate,
      });

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

    const result = await pgPool.query<{
      driver_id: string;
      latitude: number;
      longitude: number;
      h3_index: string;
    }>(
      `SELECT DISTINCT ON (driver_id)
        driver_id, latitude, longitude, h3_index
       FROM driver_locations
       WHERE h3_index = $1
         AND recorded_at > NOW() - INTERVAL '5 minutes'
       ORDER BY driver_id, recorded_at DESC`,
      [centerH3]
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
      [driverId, new Date(from), toDate]
    );

    return result.rows.map((r) => ({
      latitude: r.latitude,
      longitude: r.longitude,
      recordedAt: r.recorded_at,
    }));
  }
}
