import { Elysia, t } from 'elysia';
import { authGuard } from '../auth/guard';
import { log } from '../../shared/logger';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://admin-service:4003';

export const settings = new Elysia({ prefix: '/settings' })
  .use(authGuard)
  .get('/public', async ({ query, set }) => {
    try {
      const url = new URL(`${ADMIN_SERVICE_URL}/settings/public`);
      if (query.category) {
        url.searchParams.append('category', query.category);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
      log('error', 'Public settings proxy failed', { error: String(err) });
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
      const res = await fetch(`${ADMIN_SERVICE_URL}/settings/public/${params.key}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
      log('error', 'Public setting key proxy failed', { error: String(err) });
      set.status = 500;
      return { error: 'Internal Server Error' };
    }
  });
