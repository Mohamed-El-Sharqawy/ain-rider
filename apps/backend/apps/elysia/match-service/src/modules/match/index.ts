import { Elysia, t } from 'elysia';
import { MatchService } from './service';
import { MatchModel } from './model';
import { redisCluster } from '../../shared/redis';
import { tripLog } from '../../shared/trip-flow-logger';
import { internalAuth } from '../../shared/internal-auth';

export const match = new Elysia({ prefix: '/driver' })
  .use(internalAuth)
  .post(
    '/available',
    async ({ body }) => {
      tripLog({ step: 'DRIVER_REGISTERED', driverId: body.driverId, detail: `HTTP /available called lat=${body.latitude} lng=${body.longitude}` });
      const result = await MatchService.registerAvailableDriver(body);
      return { success: true, ...result };
    },
    { body: MatchModel.driverAvailableBody }
  )
  .post(
    '/unavailable',
    async ({ body }) => {
      await MatchService.unregisterDriver(body.driverId);
      return { success: true };
    },
    { body: MatchModel.driverUnavailableBody }
  )
  .post(
    '/respond',
    async ({ body, set, serviceCaller }) => {
      const { tripId, action, driverId } = body;

      if (driverId !== serviceCaller.sub) {
        set.status = 403;
        return { success: false, error: 'Driver ID does not match authenticated user.' };
      }

      if (action !== 'accept' && action !== 'reject') {
        set.status = 400;
        return { success: false, error: 'Invalid action. Must be "accept" or "reject".' };
      }

      const value = action === 'accept' ? 'accepted' : 'rejected';
      await redisCluster.set(`match:response:${tripId}`, value, 'EX', 60);
      tripLog({ step: value === 'accepted' ? 'DRIVER_ACCEPTED' : 'DRIVER_REJECTED', tripId, driverId, detail: `API /respond called with action=${action}` });

      return { success: true, action: value };
    },
    {
      body: t.Object({
        tripId: t.String(),
        action: t.String(),
        driverId: t.String(),
      }),
    }
  )
  .get(
    '/nearby',
    async ({ query, set }) => {
      const lat = parseFloat(query.latitude as string);
      const lng = parseFloat(query.longitude as string);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        set.status = 400;
        return { error: 'Invalid coordinates. lat must be [-90, 90], lng must be [-180, 180]' };
      }
      return await MatchService.getNearbyDrivers(lat, lng);
    },
    {
      query: t.Object({
        latitude: t.String(),
        longitude: t.String(),
      })
    }
  )
  .get('/debug', async ({ set }) => {
    if (process.env.NODE_ENV === 'production') {
      set.status = 404;
      return { error: 'Not found' };
    }
    // Scan for all driver:available:* keys
    const drivers: any[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await redisCluster.scan(cursor, 'MATCH', 'driver:available:*', 'COUNT', 100);
      cursor = next;
      for (const key of keys) {
        const val = await redisCluster.get(key);
        if (val) drivers.push(JSON.parse(val));
      }
    } while (cursor !== '0');

    // Scan for active match requests
    const matchRequests: any[] = [];
    cursor = '0';
    do {
      const [next, keys] = await redisCluster.scan(cursor, 'MATCH', 'match:request:*', 'COUNT', 100);
      cursor = next;
      for (const key of keys) {
        const val = await redisCluster.get(key);
        if (val) matchRequests.push({ key, data: JSON.parse(val) });
      }
    } while (cursor !== '0');

    // Scan for idempotency keys
    const idempotencyKeys: string[] = [];
    cursor = '0';
    do {
      const [next, keys] = await redisCluster.scan(cursor, 'MATCH', 'idempotency:trip-requested*', 'COUNT', 100);
      cursor = next;
      idempotencyKeys.push(...keys);
    } while (cursor !== '0');

    return {
      registeredDrivers: drivers,
      activeMatchRequests: matchRequests,
      idempotencyKeys,
      timestamp: new Date().toISOString(),
    };
  });
