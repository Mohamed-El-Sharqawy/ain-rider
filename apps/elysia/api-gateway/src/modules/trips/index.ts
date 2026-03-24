import { Elysia, status, t } from 'elysia';
import { authGuard } from '../auth/guard';
import { TripProxyService } from './service';
import { TripModel } from './model';

export const trips = new Elysia({ prefix: '/trips' })
  .use(authGuard)
  .post(
    '/',
    async ({ body, user }) => {
      const res = await TripProxyService.requestTrip(body, user.id);
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw status(res.status as 400 | 422, err.message || 'Trip request failed');
      }
      return res.json();
    },
    { body: TripModel.requestBody }
  )
  .get(
    '/:id',
    async ({ params, user }) => {
      const res = await TripProxyService.getTrip(params.id, user.id);
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw status(res.status as 404, err.message || 'Trip not found');
      }
      return res.json();
    },
    { params: TripModel.tripIdParams }
  )
  .patch(
    '/:id/cancel',
    async ({ params, body, user }) => {
      const res = await TripProxyService.cancelTrip(params.id, user.id, body.reason);
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        throw status(res.status as 400 | 404, err.message || 'Cancel failed');
      }
      return res.json();
    },
    {
      params: TripModel.tripIdParams,
      body: t.Object({ reason: t.String() }),
    }
  );
