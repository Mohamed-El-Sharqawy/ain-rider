import { Elysia } from 'elysia';
import { authGuard } from '../auth/guard';
import { AdminProxyService } from './service';

export const admin = new Elysia({ prefix: '/admin' })
  .use(authGuard)
  .all('/*', async ({ request, accessToken, set }) => {
    const url = new URL(request.url);
    const path = url.pathname.replace('/admin', '');
    const queryString = url.search;
    const fullPath = `${path}${queryString}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };

    let body: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
    }

    const res = await AdminProxyService.proxy(request.method, fullPath, body, headers);

    if (!res.ok) {
      // Pass through the error response from backend service
      const errorBody = await res.text();
      set.status = res.status;
      return errorBody;
    }

    return res.json();
  });
