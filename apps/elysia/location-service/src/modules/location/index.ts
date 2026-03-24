import { Elysia, status } from 'elysia';
import { LocationService } from './service';
import { LocationModel } from './model';

export const location = new Elysia({ prefix: '/location' })
  .post(
    '/update',
    async ({ body }) => {
      return LocationService.updateDriverLocation(body);
    },
    { body: LocationModel.updateBody }
  )
  .get(
    '/nearby',
    async ({ query }) => {
      return LocationService.getNearbyDrivers(query);
    },
    { query: LocationModel.nearbyQuery }
  )
  .get(
    '/history',
    async ({ query }) => {
      if (!query.driverId || !query.from) {
        throw status(400, 'driverId and from are required');
      }
      const history = await LocationService.getDriverHistory(
        query.driverId,
        query.from,
        query.to
      );
      return { driverId: query.driverId, history, count: history.length };
    },
    { query: LocationModel.historyQuery }
  );
