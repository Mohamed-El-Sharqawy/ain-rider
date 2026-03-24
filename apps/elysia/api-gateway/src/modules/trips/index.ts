import { Elysia, t } from 'elysia';
import { authGuard } from '../auth/guard';
import { TripProxyService } from './service';
import { TripModel } from './model';

export const trips = new Elysia({ prefix: '/trips' })
  .use(authGuard)
  .post(
    '/',
    async ({ body, user, set }) => {
      const res = await TripProxyService.requestTrip(body, user.id);
      if (!res.ok) {
        const errorBody = await res.text();
        set.status = res.status;
        return errorBody;
      }
      return res.json();
    },
    { body: TripModel.requestBody }
  )
  .get(
    '/:id',
    async ({ params, user, set }) => {
      const res = await TripProxyService.getTrip(params.id, user.id);
      if (!res.ok) {
        const errorBody = await res.text();
        set.status = res.status;
        return errorBody;
      }
      return res.json();
    },
    { params: TripModel.tripIdParams }
  )
  .patch(
    '/:id/cancel',
    async ({ params, body, user, set }) => {
      const res = await TripProxyService.cancelTrip(params.id, user.id, body.reason);
      if (!res.ok) {
        const errorBody = await res.text();
        set.status = res.status;
        return errorBody;
      }
      return res.json();
    },
    {
      params: TripModel.tripIdParams,
      body: t.Object({ reason: t.String() }),
    }
  );
