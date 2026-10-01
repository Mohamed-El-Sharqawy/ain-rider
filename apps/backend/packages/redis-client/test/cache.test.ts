import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheError, createCache, RedisCache } from '../src/cache'
import type { Cluster } from 'ioredis'

function createFakeCluster() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    incrby: vi.fn(),
    expire: vi.fn(),
  }
}

type FakeCluster = ReturnType<typeof createFakeCluster>

function createCacheWithFake(): { cache: RedisCache; cluster: FakeCluster } {
  const cluster = createFakeCluster()
  const cache = new RedisCache(cluster as unknown as Cluster)
  return { cache, cluster }
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RedisCache.get', () => {
  it('returns the parsed value when the key exists', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.get.mockResolvedValue('{"count":2}')
    await expect(cache.get<{ count: number }>('k')).resolves.toEqual({ count: 2 })
    expect(cluster.get).toHaveBeenCalledWith('k')
  })

  it('returns null when the key is missing', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.get.mockResolvedValue(null)
    await expect(cache.get('k')).resolves.toBeNull()
  })

  it('wraps failures in CacheError with operation and key', async () => {
    const { cache, cluster } = createCacheWithFake()
    const cause = new Error('boom')
    cluster.get.mockRejectedValue(cause)
    const err = await cache.get('k').catch((e) => e)
    expect(err).toBeInstanceOf(CacheError)
    expect(err.message).toBe('Get failed for key k')
    expect(err.operation).toBe('get')
    expect(err.key).toBe('k')
    expect(err.cause).toBe(cause)
  })
})

describe('RedisCache.set', () => {
  it('sets without ttl', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.set.mockResolvedValue('OK')
    await cache.set('k', { a: 1 })
    expect(cluster.set).toHaveBeenCalledWith('k', '{"a":1}')
    expect(cluster.setex).not.toHaveBeenCalled()
  })

  it('sets with ttl via setex', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.setex.mockResolvedValue('OK')
    await cache.set('k', 'v', 60)
    expect(cluster.setex).toHaveBeenCalledWith('k', 60, '"v"')
    expect(cluster.set).not.toHaveBeenCalled()
  })

  it('wraps failures in CacheError', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.set.mockRejectedValue(new Error('boom'))
    await expect(cache.set('k', 'v')).rejects.toThrow(CacheError)
  })
})

describe('RedisCache.del', () => {
  it('deletes the key', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.del.mockResolvedValue(1)
    await cache.del('k')
    expect(cluster.del).toHaveBeenCalledWith('k')
  })

  it('wraps failures in CacheError', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.del.mockRejectedValue(new Error('boom'))
    await expect(cache.del('k')).rejects.toThrow(CacheError)
  })
})

describe('RedisCache.exists', () => {
  it('returns true when the key exists', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.exists.mockResolvedValue(1)
    await expect(cache.exists('k')).resolves.toBe(true)
  })

  it('returns false when the key does not exist', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.exists.mockResolvedValue(0)
    await expect(cache.exists('k')).resolves.toBe(false)
  })

  it('returns false and logs on error instead of throwing', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.exists.mockRejectedValue(new Error('boom'))
    await expect(cache.exists('k')).resolves.toBe(false)
    expect(consoleError).toHaveBeenCalledWith(
      '[Redis Cache] Exists error for key k:',
      expect.any(Error),
    )
  })
})

describe('RedisCache.mget', () => {
  it('parses each present value and keeps nulls', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.get.mockImplementation(async (key: string) =>
      key === 'a' ? '{"a":1}' : key === 'c' ? '"x"' : null,
    )
    await expect(cache.mget(['a', 'b', 'c'])).resolves.toEqual([{ a: 1 }, null, 'x'])
    expect(cluster.get).toHaveBeenCalledTimes(3)
  })

  it('wraps failures in CacheError with joined keys', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.get.mockRejectedValue(new Error('boom'))
    const err = await cache.mget(['a', 'b']).catch((e) => e)
    expect(err).toBeInstanceOf(CacheError)
    expect(err.operation).toBe('mget')
    expect(err.key).toBe('a,b')
  })
})

describe('RedisCache.mset', () => {
  it('sets every entry concurrently without a ttl', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.set.mockResolvedValue('OK')
    await cache.mset({ a: 1, b: 'two' })
    expect(cluster.set).toHaveBeenCalledWith('a', '1')
    expect(cluster.set).toHaveBeenCalledWith('b', '"two"')
    expect(cluster.setex).not.toHaveBeenCalled()
  })

  it('sets every entry with setex when a ttl is given', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.setex.mockResolvedValue('OK')
    await cache.mset({ a: 1 }, 30)
    expect(cluster.setex).toHaveBeenCalledWith('a', 30, '1')
    expect(cluster.set).not.toHaveBeenCalled()
  })

  it('wraps failures in CacheError', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.set.mockRejectedValue(new Error('boom'))
    const err = await cache.mset({ a: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(CacheError)
    expect(err.operation).toBe('mset')
    expect(err.key).toBe('a')
  })
})

describe('RedisCache.increment', () => {
  it('increments by 1 by default', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.incrby.mockResolvedValue(5)
    await expect(cache.increment('k')).resolves.toBe(5)
    expect(cluster.incrby).toHaveBeenCalledWith('k', 1)
  })

  it('increments by an explicit amount', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.incrby.mockResolvedValue(10)
    await expect(cache.increment('k', 5)).resolves.toBe(10)
    expect(cluster.incrby).toHaveBeenCalledWith('k', 5)
  })

  it('wraps failures in CacheError', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.incrby.mockRejectedValue(new Error('boom'))
    await expect(cache.increment('k')).rejects.toThrow(CacheError)
  })
})

describe('RedisCache.expire', () => {
  it('expires the key', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.expire.mockResolvedValue(1)
    await cache.expire('k', 90)
    expect(cluster.expire).toHaveBeenCalledWith('k', 90)
  })

  it('wraps failures in CacheError', async () => {
    const { cache, cluster } = createCacheWithFake()
    cluster.expire.mockRejectedValue(new Error('boom'))
    await expect(cache.expire('k', 90)).rejects.toThrow(CacheError)
  })
})

describe('createCache', () => {
  it('returns a RedisCache bound to the cluster', async () => {
    const cluster = createFakeCluster()
    cluster.get.mockResolvedValue(null)
    const cache = createCache(cluster as unknown as Cluster)
    expect(cache).toBeInstanceOf(RedisCache)
    await cache.get('k')
    expect(cluster.get).toHaveBeenCalledWith('k')
  })
})
