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
    
    const resText = await res.text();
    if (!res.ok) {
      set.status = res.status;
      try {
        return JSON.parse(resText);
      } catch {
        console.error(`[LocationProxy] Non-JSON error from ${res.url} (${res.status}): ${resText.slice(0, 500)}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
      }
    }

    try {
      return JSON.parse(resText);
    } catch (e) {
      console.error(`[LocationProxy] Malformed JSON from ${res.url}: ${resText.slice(0, 500)}`);
      set.status = 500;
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Malformed response from location service' } };
    }
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
    
    const resText = await res.text();
    if (!res.ok) {
      set.status = res.status;
      try {
        return JSON.parse(resText);
      } catch {
        console.error(`[LocationProxy] Non-JSON error from ${res.url} (${res.status}): ${resText.slice(0, 500)}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
      }
    }

    try {
      return JSON.parse(resText);
    } catch (e) {
      console.error(`[LocationProxy] Malformed JSON from ${res.url}: ${resText.slice(0, 500)}`);
      set.status = 500;
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Malformed response from location service' } };
    }
  }, {
    body: t.Object({
      latitude: t.Number(),
      longitude: t.Number(),
      heading: t.Optional(t.Number()),
      speed: t.Optional(t.Number()),
    }),
  });
