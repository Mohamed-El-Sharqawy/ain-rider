import { Elysia } from 'elysia';
import { AppError, ErrorCodes } from '@ain-rider/error-handling';
import { log } from './logger';

const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET;
if (!INTERNAL_SECRET) {
  throw new Error('[InternalAuth] FATAL: INTERNAL_SERVICE_SECRET environment variable is required.');
}

async function verifyInternalToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));

    if (!payload.internal) return null;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(INTERNAL_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!isValid) return null;

    return payload;
  } catch {
    return null;
  }
}

export const internalAuth = new Elysia({ name: 'InternalAuth' }).derive(
  { as: 'scoped' },
  async ({ request, set }) => {
    // Check for x-internal-secret header (simpler method used by fetchInternal)
    const secretHeader = request.headers.get('x-internal-secret');
    if (secretHeader === INTERNAL_SECRET) {
      const userId = request.headers.get('x-user-id');
      return { serviceCaller: { internal: true, sub: userId || 'api-gateway' } };
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Internal service auth header missing');
    }

    const token = authHeader.slice(7);
    const payload = await verifyInternalToken(token);

    if (!payload) {
      log('warn', 'Internal auth failed', {
        ip: request.headers.get('x-forwarded-for'),
        hasSecretHeader: !!secretHeader
      });
      set.status = 401;
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid internal service token');
    }

    return { serviceCaller: payload };
  },
);
