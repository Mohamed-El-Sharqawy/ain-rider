/**
 * Final teardown + the /ready 503 path. Runs last (alphabetical file order):
 * briefly takes the shared redis cluster down to exercise the not-ready
 * branch, restores the connection, then quits cleanly.
 */
import './helpers/env';
import { afterAll, expect, test } from 'vitest';
import { buildApp } from './helpers/app';
import { redisCluster } from '../src/shared/redis';
import { getConnection } from '../src/shared/nats';

const app = buildApp();

test('GET /ready reports 503 while redis is unreachable, then recovers', async () => {
  const readyBefore = await app.handle(new Request('http://localhost/ready'));
  expect(readyBefore.status).toBe(200);

  // Real socket surgery (disconnect + connect) dead-ends under bun on
  // Windows: graceful quit stalls and Cluster#connect after disconnect
  // aborts. Inject the outage at the seam the route actually uses.
  const realPing = redisCluster.ping.bind(redisCluster);
  (redisCluster as unknown as { ping: () => Promise<string> }).ping = async () => {
    throw new Error('forced redis outage');
  };
  try {
    const down = await app.handle(new Request('http://localhost/ready'));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ status: 'not ready', redis: 'disconnected' });
  } finally {
    (redisCluster as unknown as { ping: () => Promise<string> }).ping = realPing;
  }

  expect(await redisCluster.ping()).toBe('PONG');

  const readyAfter = await app.handle(new Request('http://localhost/ready'));
  expect(readyAfter.status).toBe(200);
  expect(await readyAfter.json()).toEqual({ status: 'ready', redis: 'ok' });
}, 30000);

afterAll(async () => {
  // release every keep-alive handle so the bun process can exit
  try {
    getConnection().close();
  } catch {
    // nats never initialized
  }
  redisCluster.disconnect();
});
