import { Elysia, status } from 'elysia';
import { authGuard } from '../auth/guard';
import { AdminProxyService } from './service';

export const admin = new Elysia({ prefix: '/admin' })
  .use(authGuard)
  .all('/*', async ({ request, accessToken }) => {
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
      let errorMessage = 'Admin service request failed';
      try {
        const err = await res.json() as { message?: string | string[] };
        if (Array.isArray(err.message)) {
          errorMessage = err.message.join(', ');
        } else if (err.message) {
          errorMessage = err.message;
        }
      } catch {
        errorMessage = `Request failed with status ${res.status}`;
      }
      throw status(res.status as any, errorMessage);
    }

    return res.json();
  });
