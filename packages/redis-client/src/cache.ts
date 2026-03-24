import { Cluster } from 'ioredis';

export class RedisCache {
  constructor(private cluster: Cluster) {}

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.cluster.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[Redis Cache] Get error for key ${key}:`, error);
      return null;
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
      console.error(`[Redis Cache] Set error for key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cluster.del(key);
    } catch (error) {
      console.error(`[Redis Cache] Delete error for key ${key}:`, error);
      throw error;
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
      const values = await this.cluster.mget(...keys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error(`[Redis Cache] Mget error:`, error);
      return keys.map(() => null);
    }
  }

  async mset(entries: Record<string, any>, ttlSeconds?: number): Promise<void> {
    try {
      const pipeline = this.cluster.pipeline();
      
      for (const [key, value] of Object.entries(entries)) {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error(`[Redis Cache] Mset error:`, error);
      throw error;
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.cluster.incrby(key, by);
    } catch (error) {
      console.error(`[Redis Cache] Increment error for key ${key}:`, error);
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.cluster.expire(key, ttlSeconds);
    } catch (error) {
      console.error(`[Redis Cache] Expire error for key ${key}:`, error);
      throw error;
    }
  }
}

export function createCache(cluster: Cluster): RedisCache {
  return new RedisCache(cluster);
}
