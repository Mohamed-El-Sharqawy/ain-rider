/**
 * internalAuth + verifyInternalToken branch coverage, exercised through the
 * real middleware on a cheap route (/driver/unavailable for an unknown
 * driver is a side-effect-free probe).
 */
import './helpers/env';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { buildApp, bearerHeaders, post } from './helpers/app';
import { redisCluster } from '../src/shared/redis';

const app = buildApp();
const PROBE_PATH = '/driver/unavailable';
const PROBE_BODY = { driverId: 'auth-probe-unknown-driver' };

let validToken: string;

beforeAll(async () => {
  validToken = await (await import('./helpers/app')).signInternalToken({
    internal: true,
    sub: 'driver-auth-probe',
  });
});

test('missing auth header is rejected with 401', async () => {
  const res = await post(app, PROBE_PATH, PROBE_BODY, { 'content-type': 'application/json' });
  expect(res.status).toBe(401);
  expect(await res.json()).toMatchObject({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Internal service auth header missing' },
  });
});

test('bearer token without 3 dot-separated parts is rejected', async () => {
  const res = await post(app, PROBE_PATH, PROBE_BODY, bearerHeaders('not-a-jwt'));
  expect(res.status).toBe(401);
  expect(await res.json()).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
});

test('bearer token with undecodable payload hits the catch path', async () => {
  const res = await post(app, PROBE_PATH, PROBE_BODY, bearerHeaders('h.%%%.c2ln'));
  expect(res.status).toBe(401);
});

test('validly signed token without internal claim is rejected', async () => {
  const { signInternalToken } = await import('./helpers/app');
  const token = await signInternalToken({ sub: 'someone' });
  const res = await post(app, PROBE_PATH, PROBE_BODY, bearerHeaders(token));
  expect(res.status).toBe(401);
});

test('expired internal token is rejected', async () => {
  const token = await (await import('./helpers/app')).signInternalToken({
    internal: true,
    sub: 'driver-auth-probe',
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const res = await post(app, PROBE_PATH, PROBE_BODY, bearerHeaders(token));
  expect(res.status).toBe(401);
});

test('validly shaped token with a bad signature is rejected', async () => {
  const [, payload] = validToken.split('.');
  const tampered = `h.${payload}.K0NBREVGQU5ESUNF`;
  const res = await post(app, PROBE_PATH, PROBE_BODY, bearerHeaders(tampered));
  expect(res.status).toBe(401);
});

test('valid internal token passes and the route executes', { retry: 2 }, async () => {
  const res = await post(app, PROBE_PATH, PROBE_BODY, bearerHeaders(validToken));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ success: true });
});

afterAll(async () => {
  await redisCluster.del(`driver:available:auth-probe-unknown-driver`).catch(() => undefined);
});

test('internal-auth refuses to boot without INTERNAL_SERVICE_SECRET', async () => {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  delete process.env.INTERNAL_SERVICE_SECRET;
  try {
    vi.resetModules();
    await expect(import('../src/shared/internal-auth')).rejects.toThrow(
      'INTERNAL_SERVICE_SECRET environment variable is required'
    );
  } finally {
    if (secret !== undefined) process.env.INTERNAL_SERVICE_SECRET = secret;
    vi.resetModules();
  }
});
