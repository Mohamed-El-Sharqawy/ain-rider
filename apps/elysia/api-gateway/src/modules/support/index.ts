import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { authGuard } from '../auth/guard';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://localhost:4003';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-secret-987654321';

async function buildInternalToken(internalJwt: any, user: any) {
  return internalJwt.sign({
    service: 'api-gateway',
    internal: true,
    sub: user?.id || 'unknown',
    email: user?.email,
    role: user?.role || 'RIDER',
  });
}

async function proxyToAdminService(
  method: string,
  path: string,
  internalToken: string,
  body?: any,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${internalToken}`,
  };

  const res = await fetch(`${ADMIN_SERVICE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  try {
    if (res.status !== 204) {
      data = await res.json();
    }
  } catch {}

  return { status: res.status, data };
}

export const support = new Elysia({ prefix: '/support' })
  .use(authGuard)
  .use(
    jwt({
      name: 'internalJwt',
      secret: INTERNAL_SECRET,
    })
  )

  // GET /support/complaints - list user's own complaints
  .get('/complaints', async ({ user, set, internalJwt }) => {
    const internalToken = await buildInternalToken(internalJwt, user);
    try {
      const { status, data } = await proxyToAdminService(
        'GET',
        '/complaints/public',
        internalToken,
      );
      if (status >= 400) {
        set.status = status;
        return data || { success: false, error: { message: 'Failed to fetch complaints' } };
      }
      return data;
    } catch (err) {
      console.error('[SupportProxy] Failed to fetch complaints:', err);
      set.status = 500;
      return { success: false, error: { message: 'Failed to fetch complaints' } };
    }
  })

  // GET /support/complaints/:id - get single complaint
  .get('/complaints/:id', async ({ params, user, set, internalJwt }) => {
    const internalToken = await buildInternalToken(internalJwt, user);
    try {
      const { status, data } = await proxyToAdminService(
        'GET',
        `/complaints/public/${params.id}`,
        internalToken,
      );
      if (status >= 400) {
        set.status = status;
        return data || { success: false, error: { message: 'Complaint not found' } };
      }
      return data;
    } catch (err) {
      console.error('[SupportProxy] Failed to fetch complaint:', err);
      set.status = 500;
      return { success: false, error: { message: 'Failed to fetch complaint' } };
    }
  })

  // POST /support/complaints - create complaint
  .post('/complaints', async ({ user, set, internalJwt, body }) => {
    const internalToken = await buildInternalToken(internalJwt, user);
    try {
      const { status, data } = await proxyToAdminService(
        'POST',
        '/complaints/public',
        internalToken,
        body,
      );
      if (status >= 400) {
        set.status = status;
        return data || { success: false, error: { message: 'Admin service error' } };
      }
      return data;
    } catch (err) {
      console.error('[SupportProxy] Failed to create complaint:', err);
      set.status = 500;
      return { success: false, error: { message: 'Failed to submit complaint' } };
    }
  })

  // POST /support/complaints/:id/comments - add comment
  .post('/complaints/:id/comments', async ({ params, user, set, internalJwt, body }) => {
    const internalToken = await buildInternalToken(internalJwt, user);
    try {
      const { status, data } = await proxyToAdminService(
        'POST',
        `/complaints/public/${params.id}/comments`,
        internalToken,
        body,
      );
      if (status >= 400) {
        set.status = status;
        return data || { success: false, error: { message: 'Failed to add comment' } };
      }
      return data;
    } catch (err) {
      console.error('[SupportProxy] Failed to add comment:', err);
      set.status = 500;
      return { success: false, error: { message: 'Failed to add comment' } };
    }
  });
