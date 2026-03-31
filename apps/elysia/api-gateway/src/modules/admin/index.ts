import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { authGuard } from '../auth/guard';
import { AdminProxyService } from './service';

// const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
// const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://localhost:4001';
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://localhost:4003';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-secret-987654321';

export const admin = new Elysia({ prefix: '/admin' })
  .use(authGuard)
  .use(
    jwt({
      name: 'internalJwt',
      secret: INTERNAL_SECRET,
    })
  )
  .all('/*', async ({ request, accessToken, user, set, internalJwt }) => {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Determine target service and path
    const targetUrl = ADMIN_SERVICE_URL;
    const targetPath = path.replace('/admin', '');

    // 2. Generate internal service token (api-gateway -> backend-service)
    // Ensure payload is a clean POJO with user info for authorization
    const internalToken = await internalJwt.sign({
      service: 'api-gateway',
      internal: true,
      sub: user?.id || 'admin',
      email: user?.email,
      role: user?.role || 'ADMIN',
    });

    // 3. Prepare body
    let body: any = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const contentType = request.headers.get('content-type');
        const contentLength = parseInt(request.headers.get('content-length') || '0');

        // Only try to parse JSON if content-type is json AND there is actually data
        if (contentType?.includes('application/json') && contentLength > 0) {
          body = await request.json();
        } else if (contentType?.includes('application/json')) {
          // Some clients send application/json even for empty PATCH/POST
          // We'll leave body as undefined instead of failing
          body = undefined;
        }
      } catch (err) {
        // Log but don't fail for empty body errors that are common in some clients
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('Body cannot be empty')) {
          console.error('[AdminProxy] Failed to parse request body:', err);
        }
      }
    }

    // 4. Proxy to target service
    const res = await AdminProxyService.proxyTo(targetUrl, request.method, targetPath, body, {
      'Authorization': `Bearer ${internalToken}`,
      'X-Admin-Token': String(accessToken),
    });

    // 5. Response handling
    if (!res.ok) {
      set.status = res.status;
      try {
        return await res.json();
      } catch {
        return {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: `Target service error: ${res.statusText}` }
        };
      }
    }

    // Optimization: If response is JSON, return it parsed. 
    // Otherwise, we might need to handle other content types, but for Admin API it's usually JSON.
    try {
      return await res.json();
    } catch {
      return { success: true };
    }
  });
