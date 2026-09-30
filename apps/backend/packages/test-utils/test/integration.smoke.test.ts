/**
 * Harness smoke test: proves the integration harness works end to end
 * against the docker infra (postgres, NATS, redis cluster, minio).
 *
 * Prerequisite: pnpm docker:infra:up
 * Run: pnpm --filter @ain-rider/test-utils test
 */
import { afterAll, expect, test } from 'vitest';
import {
  closeTestDbPools,
  createTestMinio,
  createTestNatsConnection,
  createTestRedis,
  ensureTestBucket,
  ensureTestDatabase,
  resetTestDatabase,
} from '../src';

const LONG = 120_000;

test(
  'postgres: ensureTestDatabase creates the trip test db and resetTestDatabase truncates it',
  async () => {
    await ensureTestDatabase('trip');
    await resetTestDatabase('trip');

    const { getTestDbPool } = await import('../src/db');
    const pool = getTestDbPool('trip');
    await pool.query(
      `CREATE TABLE IF NOT EXISTS _harness_smoke (id TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    await pool.query(`INSERT INTO _harness_smoke (id, value) VALUES ($1, $2)`, [
      'smoke',
      'postgres works',
    ]);

    const before = await pool.query<{ value: string }>(
      `SELECT value FROM _harness_smoke WHERE id = $1`,
      ['smoke'],
    );
    expect(before.rows[0]?.value).toBe('postgres works');

    await resetTestDatabase('trip');
    const { getTestDbPool: getPool } = await import('../src/db');
    const check = getPool('trip');
    const after = await check.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM _harness_smoke`,
    );
    expect(after.rows[0]?.count).toBe('0');
  },
  LONG,
);

test(
  'nats: publish and subscribe round-trip against the docker cluster',
  async () => {
    const { connect } = await import('nats');
    void connect;
    const nc = await createTestNatsConnection('smoke');
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const received = new Promise<string>((resolve) => {
        const sub = nc.subscribe('test.harness.smoke', { max: 1 });
        void (async () => {
          for await (const message of sub) {
            resolve(decoder.decode(message.data));
          }
        })();
      });
      await nc.publish('test.harness.smoke', encoder.encode('nats works'));
      await expect(received).resolves.toBe('nats works');
    } finally {
      await nc.drain();
    }
  },
  LONG,
);

test(
  'redis: cluster set/get/del against the docker cluster',
  async () => {
    const redis = createTestRedis('smoke:');
    try {
      await redis.set('smoke:key', 'redis works');
      await expect(redis.get('smoke:key')).resolves.toBe('redis works');
      await redis.del('smoke:key');
      await expect(redis.get('smoke:key')).resolves.toBeNull();
    } finally {
      await redis.quit();
    }
  },
  LONG,
);

test(
  'minio: put and get an object in the test bucket',
  async () => {
    const client = createTestMinio();
    const bucket = await ensureTestBucket(client);
    const body = 'minio works';
    await client.putObject(bucket, 'harness/smoke.txt', body, {
      'Content-Type': 'text/plain',
    });

    const stream = await client.getObject(bucket, 'harness/smoke.txt');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe(body);
    await client.removeObject(bucket, 'harness/smoke.txt');
  },
  LONG,
);

afterAll(async () => {
  await closeTestDbPools();
});
