import './env';
import { Elysia } from 'elysia';
import { traceMiddleware } from '../../src/shared/trace';
import { errorHandler } from '../../src/shared/error-handler';
import { health } from '../../src/modules/health';
import { match } from '../../src/modules/match';

/** The real app shape from src/index.ts (trace + error handling + routes). */
export function buildApp(): Elysia {
  return new Elysia().use(traceMiddleware).use(errorHandler).use(health).use(match);
}

function b64(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Mint a token the service's internalAuth.verifyInternalToken accepts. */
export async function signInternalToken(
  payload: Record<string, unknown>,
): Promise<string> {
  const enc = new TextEncoder();
  const secret = process.env.INTERNAL_SERVICE_SECRET!;
  const header = b64(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64(sig)}`;
}

export function internalAuthHeaders(sub: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_SERVICE_SECRET!,
    'x-user-id': sub,
  };
}

export function bearerHeaders(token: string): Record<string, string> {
  return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
}

export async function post(
  app: Elysia,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<Response> {
  return app.handle(new Request(`http://localhost${path}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  }));
}
