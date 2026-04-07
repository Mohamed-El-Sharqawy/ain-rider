import { Elysia, t } from 'elysia';
import { authGuard } from '../auth/guard';
import { MatchProxyService } from './service';

export const matchProxy = new Elysia({ prefix: '/match' })
  .use(authGuard)
  .post('/available', async ({ body, user, set }) => {
    if (user.role !== 'DRIVER') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    const res = await MatchProxyService.registerAvailable(user.id, body);
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
  }, {
    body: t.Object({
      latitude: t.Number(),
      longitude: t.Number(),
      vehicleTypeId: t.String(),
      driverName: t.Optional(t.String()),
      driverPhone: t.Optional(t.String()),
      driverRating: t.Optional(t.Number()),
      vehicleMake: t.Optional(t.String()),
      vehicleModel: t.Optional(t.String()),
      vehiclePlate: t.Optional(t.String()),
    }),
  })
  .post('/respond', async ({ body, user, set }) => {
    if (user.role !== 'DRIVER') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    const res = await MatchProxyService.respondToTrip(body.tripId, user.id, body.action);
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
  }, {
    body: t.Object({ tripId: t.String(), action: t.String() }),
  })
  .post('/unavailable', async ({ user, set }) => {
    if (user.role !== 'DRIVER') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    const res = await MatchProxyService.unregisterAvailable(user.id);
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
  })
  .get('/nearby', async ({ query, user, set }) => {
    const lat = parseFloat(query.latitude as string);
    const lng = parseFloat(query.longitude as string);
    const res = await MatchProxyService.getNearbyDrivers(user.id, lat, lng);
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
  }, {
    query: t.Object({
      latitude: t.String(),
      longitude: t.String(),
    })
  });
