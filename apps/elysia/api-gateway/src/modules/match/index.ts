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
    
    const resText = await res.text();
    if (!res.ok) {
      set.status = res.status;
      try {
        return JSON.parse(resText);
      } catch {
        console.error(`[MatchProxy] Non-JSON error from ${res.url} (${res.status}): ${resText.slice(0, 500)}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
      }
    }

    try {
      return JSON.parse(resText);
    } catch (e) {
      console.error(`[MatchProxy] Malformed JSON from ${res.url}: ${resText.slice(0, 500)}`);
      set.status = 500;
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Malformed response from match service' } };
    }
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
    
    const resText = await res.text();
    if (!res.ok) {
      set.status = res.status;
      try {
        return JSON.parse(resText);
      } catch {
        console.error(`[MatchProxy] Non-JSON error from ${res.url} (${res.status}): ${resText.slice(0, 500)}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
      }
    }

    try {
      return JSON.parse(resText);
    } catch (e) {
      console.error(`[MatchProxy] Malformed JSON from ${res.url}: ${resText.slice(0, 500)}`);
      set.status = 500;
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Malformed response from match service' } };
    }
  }, {
    body: t.Object({ tripId: t.String(), action: t.String() }),
  })
  .post('/unavailable', async ({ user, set }) => {
    if (user.role !== 'DRIVER') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    const res = await MatchProxyService.unregisterAvailable(user.id);
    
    const resText = await res.text();
    if (!res.ok) {
      set.status = res.status;
      try {
        return JSON.parse(resText);
      } catch {
        console.error(`[MatchProxy] Non-JSON error from ${res.url} (${res.status}): ${resText.slice(0, 500)}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
      }
    }

    try {
      return JSON.parse(resText);
    } catch (e) {
      console.error(`[MatchProxy] Malformed JSON from ${res.url}: ${resText.slice(0, 500)}`);
      set.status = 500;
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Malformed response from match service' } };
    }
  })
  .get('/nearby', async ({ query, user, set }) => {
    const lat = parseFloat(query.latitude as string);
    const lng = parseFloat(query.longitude as string);
    const res = await MatchProxyService.getNearbyDrivers(user.id, lat, lng);
    
    const resText = await res.text();
    if (!res.ok) {
      set.status = res.status;
      try {
        return JSON.parse(resText);
      } catch {
        console.error(`[MatchProxy] Non-JSON error from ${res.url} (${res.status}): ${resText.slice(0, 500)}`);
        return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
      }
    }

    try {
      return JSON.parse(resText);
    } catch (e) {
      console.error(`[MatchProxy] Malformed JSON from ${res.url}: ${resText.slice(0, 500)}`);
      set.status = 500;
      return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Malformed response from match service' } };
    }
  }, {
    query: t.Object({
      latitude: t.String(),
      longitude: t.String(),
    })
  });
