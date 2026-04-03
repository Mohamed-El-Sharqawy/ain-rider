import { Elysia, t } from 'elysia';
import { authGuard } from '../auth/guard';
import { LocationProxyService } from './service';

export const locationProxy = new Elysia({ prefix: '/location' })
  .use(authGuard)
  .get('/nearby', async ({ query, set }) => {
    const res = await LocationProxyService.getNearbyDrivers(
      parseFloat(query.latitude),
      parseFloat(query.longitude),
    );
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
    }),
  })
  .post('/update', async ({ body, user, set }) => {
    if (user.role !== 'DRIVER') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    const res = await LocationProxyService.updateDriverLocation(user.id, body);
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
      heading: t.Optional(t.Number()),
      speed: t.Optional(t.Number()),
    }),
  });
