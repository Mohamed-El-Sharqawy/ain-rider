import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import { UnauthorizedError } from '@ain-rider/error-handling';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export const authGuard = new Elysia({ name: 'Auth.Guard' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'local_dev_secret_change_in_production',
  }))
  .use(cookie())
  .derive({ as: 'scoped' }, async (ctx) => {
    const { cookie: cookies, jwt } = ctx;

    const token = cookies.accessToken?.value;
    
    console.log('[AuthGuard] Cookie check:', {
      hasCookie: !!cookies.accessToken,
      hasValue: !!token,
      tokenPreview: token ? (token as string).substring(0, 20) + '...' : 'none',
    });

    if (!token) {
      throw new UnauthorizedError('Not authenticated - no access token');
    }

    try {
      const payload = await jwt.verify(token as string) as unknown as JwtPayload;
      
      return {
        accessToken: token,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      };
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });
