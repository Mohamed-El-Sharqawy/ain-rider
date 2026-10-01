import { Cluster } from 'ioredis';

export class CacheError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly key: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export class RedisCache {
  constructor(private cluster: Cluster) { }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.cluster.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      throw new CacheError(`Get failed for key ${key}`, 'get', key, error);
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.cluster.setex(key, ttlSeconds, serialized);
      } else {
        await this.cluster.set(key, serialized);
      }
    } catch (error) {
      throw new CacheError(`Set failed for key ${key}`, 'set', key, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cluster.del(key);
    } catch (error) {
      throw new CacheError(`Delete failed for key ${key}`, 'del', key, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.cluster.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Redis Cache] Exists error for key ${key}:`, error);
      return false;
    }
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      // Redis Cluster only allows multi-key commands within a single hash
      // slot, so fan out to one GET per key instead of MGET.
      const values = await Promise.all(keys.map((key) => this.cluster.get(key)));
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      throw new CacheError('Mget failed', 'mget', keys.join(','), error);
    }
  }

  async mset(entries: Record<string, any>, ttlSeconds?: number): Promise<void> {
    try {
      // Pipelines on a cluster require all keys in the same hash slot group,
      // which arbitrary cache keys do not satisfy. Fan out per key instead.
      await Promise.all(
        Object.entries(entries).map(([key, value]) => {
          const serialized = JSON.stringify(value);
          return ttlSeconds
            ? this.cluster.setex(key, ttlSeconds, serialized)
            : this.cluster.set(key, serialized);
        }),
      );
    } catch (error) {
      throw new CacheError('Mset failed', 'mset', Object.keys(entries).join(','), error);
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.cluster.incrby(key, by);
    } catch (error) {
      throw new CacheError(`Increment failed for key ${key}`, 'increment', key, error);
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.cluster.expire(key, ttlSeconds);
    } catch (error) {
      throw new CacheError(`Expire failed for key ${key}`, 'expire', key, error);
    }
  }
}

export function createCache(cluster: Cluster): RedisCache {
  return new RedisCache(cluster);
}
