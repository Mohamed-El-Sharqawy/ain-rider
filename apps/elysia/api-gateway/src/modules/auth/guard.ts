import { Elysia, status } from 'elysia';
import { cookie } from '@elysiajs/cookie';

export const authGuard = new Elysia({ name: 'Auth.Guard' })
  .use(cookie())
  .derive({ as: 'scoped' }, async (ctx) => {
    const { cookie: cookies } = ctx;

    const token = cookies.accessToken?.value;
    
    console.log('[AuthGuard] Cookie check:', {
      hasCookie: !!cookies.accessToken,
      hasValue: !!token,
      tokenPreview: token ? (token as string).substring(0, 20) + '...' : 'none',
    });

    if (!token) {
      throw status(401, 'Not authenticated - no access token');
    }

    return {
      accessToken: token,
    };
  });
