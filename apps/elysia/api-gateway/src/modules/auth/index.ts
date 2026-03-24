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
    async ({ body, cookie: { accessToken, refreshToken } }) => {
      const res = await AuthProxyService.login(body);
      if (!res.ok) {
        let errorMessage = 'Login failed';
        try {
          const err = await res.json() as { message?: string | string[] };
          if (Array.isArray(err.message)) {
            errorMessage = err.message.join(', ');
          } else if (err.message) {
            errorMessage = err.message;
          }
        } catch {
          errorMessage = `Login failed with status ${res.status}`;
        }
        throw status(res.status as 400 | 401, errorMessage);
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
    async ({ body, cookie: { accessToken, refreshToken } }) => {
      const res = await AuthProxyService.register(body);
      if (!res.ok) {
        let errorMessage = 'Registration failed';
        try {
          const err = await res.json() as { message?: string | string[] };
          if (Array.isArray(err.message)) {
            errorMessage = err.message.join(', ');
          } else if (err.message) {
            errorMessage = err.message;
          }
        } catch {
          errorMessage = `Registration failed with status ${res.status}`;
        }
        throw status(res.status as 400 | 409, errorMessage);
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
  .post('/refresh', async ({ cookie: { accessToken, refreshToken } }) => {
    if (!refreshToken.value) {
      throw status(401, 'No refresh token');
    }

    const res = await AuthProxyService.refresh(refreshToken.value as string);
    if (!res.ok) {
      refreshToken.remove();
      accessToken.remove();
      throw status(401, 'Invalid refresh token');
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
  .get('/me', async ({ cookie: { accessToken }, request }) => {
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
      let errorMessage = 'Invalid session';
      try {
        const err = await res.json() as { message?: string | string[] };
        if (Array.isArray(err.message)) {
          errorMessage = err.message.join(', ');
        } else if (err.message) {
          errorMessage = err.message;
        }
      } catch {
        errorMessage = `Authentication failed with status ${res.status}`;
      }
      throw status(401, errorMessage);
    }

    return res.json();
  });
