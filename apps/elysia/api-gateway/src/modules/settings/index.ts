import { Elysia, t } from 'elysia';
import { fetchInternal } from '@ain-rider/internal-api';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://admin-service:4003';

export const settings = new Elysia({ prefix: '/settings' })
  // Public routes - no auth required
  .get('/public', async ({ query, set }) => {
    const url = new URL(`${ADMIN_SERVICE_URL}/settings/public`);
    if (query.category) {
      url.searchParams.append('category', query.category);
    }

    try {
      const res = await fetchInternal(url.toString(), 'GET', undefined, {
        targetService: 'admin-service',
      });

      if (!res.ok) {
        set.status = res.status;
        try {
          return await res.json();
        } catch {
          return { error: 'Failed to fetch public settings' };
        }
      }

      return res.json();
    } catch (err) {
      set.status = 500;
      return { error: 'Internal Server Error' };
    }
  }, {
    query: t.Object({
      category: t.Optional(t.String()),
    }),
  })
  .get('/public/:key', async ({ params, set }) => {
    try {
      const res = await fetchInternal(`${ADMIN_SERVICE_URL}/settings/public/${params.key}`, 'GET', undefined, {
        targetService: 'admin-service',
      });

      if (!res.ok) {
        set.status = res.status;
        try {
          return await res.json();
        } catch {
          return { error: 'Failed to fetch public setting' };
        }
      }

      return res.json();
    } catch (err) {
      set.status = 500;
      return { error: 'Internal Server Error' };
    }
  })
  // GET /settings/cancellation-reasons - public endpoint for mobile
  .get('/cancellation-reasons', async ({ query, set }) => {
    const url = new URL(`${ADMIN_SERVICE_URL}/settings/cancellation-reasons`);
    if (query.type) {
      url.searchParams.append('type', query.type);
    }

    try {
      const res = await fetchInternal(url.toString(), 'GET', undefined, {
        targetService: 'admin-service',
      });

      if (!res.ok) {
        set.status = res.status;
        try {
          return await res.json();
        } catch {
          return { error: 'Failed to fetch cancellation reasons' };
        }
      }

      return res.json();
    } catch (err) {
      set.status = 500;
      return { error: 'Internal Server Error' };
    }
  }, {
    query: t.Object({
      type: t.Optional(t.String()),
    }),
  });
