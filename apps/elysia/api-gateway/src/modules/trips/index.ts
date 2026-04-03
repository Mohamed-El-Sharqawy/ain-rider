import { Elysia, t } from 'elysia';
import { authGuard } from '../auth/guard';
import { TripProxyService } from './service';
import { TripModel } from './model';

export const trips = new Elysia({ prefix: '/trips' })
  .use(authGuard)
  .post(
    '/estimate',
    async ({ body, set }) => {
      const res = await TripProxyService.estimateFare(body);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
        }
      }
      return res.json();
    },
    { body: TripModel.estimateBody }
  )
  .post(
    '/',
    async ({ body, user, set }) => {
      const res = await TripProxyService.requestTrip(body, user.id);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
        }
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
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
        }
      }
      return res.json();
    },
    { params: TripModel.tripIdParams }
  )
  .patch(
    '/:id/status',
    async ({ params, body, user, set }) => {
      if (user.role !== 'DRIVER') {
        set.status = 403;
        return { error: 'Forbidden' };
      }
      const res = await TripProxyService.updateStatus(params.id, body.status, user.id);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
        }
      }
      return res.json();
    },
    {
      params: TripModel.tripIdParams,
      body: TripModel.statusUpdateBody,
    }
  )
  .patch(
    '/:id/cancel',
    async ({ params, body, user, set }) => {
      const res = await TripProxyService.cancelTrip(params.id, user.id, body.reason);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
        }
      }
      return res.json();
    },
    {
      params: TripModel.tripIdParams,
      body: t.Object({ reason: t.String() }),
    }
  )
  .patch(
    '/:id/reject',
    async ({ params, body, user, set }) => {
      if (user.role !== 'DRIVER') {
        set.status = 403;
        return { error: 'Forbidden' };
      }
      const res = await TripProxyService.rejectTrip(params.id, user.id, body.reason);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
        }
      }
      return res.json();
    },
    {
      params: TripModel.tripIdParams,
      body: t.Object({ reason: t.Optional(t.String()) }),
    }
  );
