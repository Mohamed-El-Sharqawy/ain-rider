import { Elysia, status } from 'elysia';
import { AuthProxyService } from './service';
import { AuthModel } from './model';

const isProduction = process.env.NODE_ENV === 'production';
const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const SAME_SITE = isProduction ? 'strict' : 'lax';

console.log('[Auth Module] Configuration:', {
  isProduction,
  sameSite: SAME_SITE,
  secure: isProduction,
});

export const auth = new Elysia({ prefix: '/auth' })
  .post(
    '/login',
    async ({ body, cookie: { accessToken, refreshToken }, set }) => {
      const res = await AuthProxyService.login(body);
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

      const data = await res.json() as { user: unknown; accessToken: string; refreshToken: string };

      accessToken.value = data.accessToken;
      accessToken.httpOnly = true;
      accessToken.secure = isProduction;
      accessToken.sameSite = SAME_SITE;
      accessToken.maxAge = ACCESS_TOKEN_MAX_AGE;
      accessToken.path = '/';

      refreshToken.value = data.refreshToken;
      refreshToken.httpOnly = true;
      refreshToken.secure = isProduction;
      refreshToken.sameSite = SAME_SITE;
      refreshToken.maxAge = REFRESH_TOKEN_MAX_AGE;
      refreshToken.path = '/';

      return { user: data.user, success: true };
    },
    { body: AuthModel.loginBody }
  )
  .post(
    '/register',
    async ({ body, cookie: { accessToken, refreshToken }, set }) => {
      const res = await AuthProxyService.register(body);
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

      const data = await res.json() as { user: unknown; accessToken: string; refreshToken: string };

      accessToken.value = data.accessToken;
      accessToken.httpOnly = true;
      accessToken.secure = isProduction;
      accessToken.sameSite = SAME_SITE;
      accessToken.maxAge = ACCESS_TOKEN_MAX_AGE;
      accessToken.path = '/';

      refreshToken.value = data.refreshToken;
      refreshToken.httpOnly = true;
      refreshToken.secure = isProduction;
      refreshToken.sameSite = SAME_SITE;
      refreshToken.maxAge = REFRESH_TOKEN_MAX_AGE;
      refreshToken.path = '/';

      return { user: data.user, success: true };
    },
    { body: AuthModel.registerBody }
  )
  .post('/refresh', async ({ cookie: { accessToken, refreshToken }, set }) => {
    if (!refreshToken.value) {
      throw status(401, 'No refresh token');
    }

    const res = await AuthProxyService.refresh(refreshToken.value as string);
    if (!res.ok) {
      refreshToken.remove();
      accessToken.remove();
      const errorBody = await res.text();
      set.status = res.status;
      return errorBody;
    }

    const data = await res.json() as { accessToken: string };

    accessToken.value = data.accessToken;
    accessToken.httpOnly = true;
    accessToken.secure = isProduction;
    accessToken.sameSite = 'strict';
    accessToken.maxAge = ACCESS_TOKEN_MAX_AGE;
    accessToken.path = '/';

    return { success: true };
  })
  .post('/logout', async ({ cookie: { accessToken, refreshToken } }) => {
    accessToken.remove();
    refreshToken.remove();
    return { success: true };
  })
  .get('/me', async ({ cookie: { accessToken }, request, set }) => {
    console.log('[/auth/me] Request:', {
      hasCookie: !!accessToken,
      hasValue: !!accessToken?.value,
      cookieHeader: request.headers.get('cookie'),
    });

    if (!accessToken.value) {
      throw status(401, 'Not authenticated');
    }

    const res = await AuthProxyService.getMe(accessToken.value as string);
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
  })
  .post(
    '/admin/create-user',
    async ({ body, cookie: { accessToken }, set }) => {
      if (!accessToken.value) {
        throw status(401, 'Not authenticated');
      }

      const res = await AuthProxyService.adminCreateUser(accessToken.value as string, body);
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
    },
    { body: AuthModel.adminCreateUserBody }
  );
