/**
 * Minimal smoke test: proves `bun test` runs against the real service code
 * and the health route answers without any infra dependency.
 */
import { afterAll, expect, test } from 'bun:test';
import { health } from '../src/modules/health';
import { redisCluster } from '../src/shared/redis';

test('GET /health reports ok', async () => {
  const response = await health.handle(new Request('http://localhost/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'websocket-server' });
});

afterAll(async () => {
  await redisCluster.quit().catch(() => undefined);
});
