/**
 * Minimal smoke test: proves `bun test` runs against the real service code
 * and the health route answers without any infra dependency.
 */
import './helpers/env';
import { expect, test } from 'vitest';
import { health } from '../src/modules/health';

test('GET /health reports ok', async () => {
  const response = await health.handle(new Request('http://localhost/health'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'match-service' });
});
