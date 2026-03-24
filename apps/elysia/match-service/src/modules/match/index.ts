import { Elysia } from 'elysia';
import { MatchService } from './service';
import { MatchModel } from './model';

export const match = new Elysia({ prefix: '/driver' })
  .post(
    '/available',
    async ({ body }) => {
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
  );
