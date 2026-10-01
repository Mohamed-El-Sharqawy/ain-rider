import { Elysia, t } from 'elysia';
import { MatchService } from './service';
import { MatchModel } from './model';
import { KEY_PREFIX, redisCluster } from '../../shared/redis';
import { tripLog } from '../../shared/trip-flow-logger';
import { internalAuth } from '../../shared/internal-auth';

/**
 * SCAN only walks a single master on a redis cluster, so every master must
 * be scanned to see the full keyspace. Patterns must use the physical key
 * prefix; SCAN's MATCH option is never auto-prefixed.
 */
async function scanClusterKeys(pattern: string): Promise<string[]> {
  const masters = await redisCluster.nodes('master');
  const keys: string[] = [];
  for (const node of masters) {
    let cursor = '0';
    do {
      const [next, found] = await node.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...found);
    } while (cursor !== '0');
  }
  return keys;
}

function stripKeyPrefix(key: string): string {
  /* v8 ignore next  -- scanned keys always carry the match: prefix */
  return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key;
}

/** Parse a scanned record; a debug listing must survive corrupt entries. */
function parseDebugValue(raw: string | null): any | null {
  /* v8 ignore next  -- key cannot vanish between SCAN and GET in a listing */
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    tripLog({ step: 'ERROR', detail: `debug scan skipped unparsable record: ${String(error)}` });
    return null;
  }
}

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
    for (const key of await scanClusterKeys(`${KEY_PREFIX}driver:available:*`)) {
      const value = parseDebugValue(await redisCluster.get(stripKeyPrefix(key)));
      if (value) drivers.push(value);
    }

    // Scan for active match requests
    const matchRequests: any[] = [];
    for (const key of await scanClusterKeys(`${KEY_PREFIX}match:request:*`)) {
      const value = parseDebugValue(await redisCluster.get(stripKeyPrefix(key)));
      if (value) matchRequests.push({ key: stripKeyPrefix(key), data: value });
    }

    // Scan for idempotency keys
    const idempotencyKeys = (await scanClusterKeys(`${KEY_PREFIX}idempotency:trip-requested*`))
      .map(stripKeyPrefix);

    return {
      registeredDrivers: drivers,
      activeMatchRequests: matchRequests,
      idempotencyKeys,
      timestamp: new Date().toISOString(),
    };
  });