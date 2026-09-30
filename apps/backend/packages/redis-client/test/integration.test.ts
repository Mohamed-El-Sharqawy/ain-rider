/**
 * Integration tests against the docker redis cluster
 * (apps/backend/docker-compose.yml: localhost:6379-6384).
 *
 * All keys use the `test:rc:` prefix and are deleted afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRedisCluster, RedisCache } from '../src'
import type { Cluster } from 'ioredis'

const DEFAULT_NODES = 'localhost:6379,localhost:6380,localhost:6381,localhost:6382,localhost:6383,localhost:6384'
const DEFAULT_NAT_MAP =
  'ain-rider-redis-1:6379>localhost:6379,' +
  'ain-rider-redis-2:6379>localhost:6380,' +
  'ain-rider-redis-3:6379>localhost:6381,' +
  'ain-rider-redis-4:6379>localhost:6382,' +
  'ain-rider-redis-5:6379>localhost:6383,' +
  'ain-rider-redis-6:6379>localhost:6384'

process.env.REDIS_NODES = process.env.REDIS_NODES || DEFAULT_NODES
process.env.REDIS_NAT_MAP = process.env.REDIS_NAT_MAP || DEFAULT_NAT_MAP

const nodes = process.env.REDIS_NODES.split(',').map((n) => n.trim())

const LONG = 60_000

let cluster: Cluster
let cache: RedisCache

const KEYS = [
  'test:rc:single',
  'test:rc:typed',
  'test:rc:ttl',
  'test:rc:counter',
  'test:rc:expire',
  'test:rc:mset:a',
  'test:rc:mset:b',
  'test:rc:missing',
]

beforeAll(async () => {
  cluster = createRedisCluster({ nodes })
  cache = new RedisCache(cluster)
  await cluster.ping()
}, LONG)

afterAll(async () => {
  if (cluster) {
    // one DEL per key: multi-key DEL is not cross-slot safe on a cluster
    await Promise.all(KEYS.map((key) => cluster.del(key).catch(() => undefined)))
    await cluster.quit().catch(() => undefined)
  }
}, LONG)

describe('createRedisCluster against the docker cluster', () => {
  it('connects and reaches ready state through the NAT map', () => {
    expect(cluster.status).toBe('ready')
  }, LONG)

  it('isolates keys behind a configured keyPrefix', async () => {
    const prefixed = createRedisCluster({ nodes, keyPrefix: 'test:rc:prefixed:' })
    try {
      const raw = new RedisCache(prefixed)
      await raw.set('nested', 'behind-prefix')
      expect(await cluster.get('test:rc:prefixed:nested')).toBe('"behind-prefix"')
      await cluster.del('test:rc:prefixed:nested')
    } finally {
      await prefixed.quit()
    }
  }, LONG)
})

describe('RedisCache against the docker cluster', () => {
  it('sets and gets a json value', async () => {
    await cache.set('test:rc:single', 'hello')
    await expect(cache.get('test:rc:single')).resolves.toBe('hello')

    await cache.set('test:rc:typed', { count: 3, nested: true })
    await expect(cache.get('test:rc:typed')).resolves.toEqual({ count: 3, nested: true })
  }, LONG)

  it('returns null for a missing key', async () => {
    await expect(cache.get('test:rc:missing')).resolves.toBeNull()
  }, LONG)

  it('expires a key after its ttl', async () => {
    await cache.set('test:rc:ttl', 'ephemeral', 1)
    await expect(cache.get('test:rc:ttl')).resolves.toBe('ephemeral')
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await expect(cache.get('test:rc:ttl')).resolves.toBeNull()
  }, LONG)

  it('reports existence', async () => {
    await cache.set('test:rc:single', 'hello')
    await expect(cache.exists('test:rc:single')).resolves.toBe(true)
    await expect(cache.exists('test:rc:missing')).resolves.toBe(false)
  }, LONG)

  it('increments counters', async () => {
    await expect(cache.increment('test:rc:counter')).resolves.toBe(1)
    await expect(cache.increment('test:rc:counter')).resolves.toBe(2)
    await expect(cache.increment('test:rc:counter', 5)).resolves.toBe(7)
  }, LONG)

  it('applies expire to a key', async () => {
    await cache.set('test:rc:expire', 'v')
    await cache.expire('test:rc:expire', 90)
    const ttl = await cluster.ttl('test:rc:expire')
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(90)
  }, LONG)

  it('mset and mget round-trip multiple keys', async () => {
    await cache.mset({ 'test:rc:mset:a': { x: 1 }, 'test:rc:mset:b': 'two' })
    await expect(cache.mget(['test:rc:mset:a', 'test:rc:missing', 'test:rc:mset:b'])).resolves.toEqual([
      { x: 1 },
      null,
      'two',
    ])
  }, LONG)

  it('deletes keys', async () => {
    await cache.set('test:rc:single', 'hello')
    await cache.del('test:rc:single')
    await expect(cache.get('test:rc:single')).resolves.toBeNull()
  }, LONG)
})
