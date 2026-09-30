import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { authGuard } from '../auth/guard';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://localhost:4003';
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;
if (!INTERNAL_SECRET) {
  throw new Error('[SupportProxy] FATAL: INTERNAL_SERVICE_SECRET environment variable is required. Refusing to start.');
}

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
  .get('/complaints', async ({ user, set, internalJwt, query }) => {
    const internalToken = await buildInternalToken(internalJwt, user);
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', query.limit);
    if (query.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    try {
      const { status, data } = await proxyToAdminService(
        'GET',
        `/complaints/public${qs ? `?${qs}` : ''}`,
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
  }, {
    query: t.Object({
      limit: t.Optional(t.String()),
      cursor: t.Optional(t.String()),
    }),
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
  }, {
    body: t.Object({
      type: t.String({ minLength: 1 }),
      subject: t.String({ minLength: 1 }),
      description: t.String({ minLength: 1 }),
      againstUserId: t.Optional(t.String()),
      tripId: t.Optional(t.String()),
      priority: t.Optional(t.String()),
    }),
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
  }, {
    body: t.Object({
      comment: t.String({ minLength: 1 }),
      isInternal: t.Optional(t.Boolean()),
    }),
  });
