import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createRedisCluster, createCache, RedisCache } from '@ain-rider/redis-client';

const USER_CACHE_TTL = 300;
const USER_LIST_CACHE_TTL = 60;
const USER_STATS_CACHE_TTL = 30;

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private cluster: ReturnType<typeof createRedisCluster>;
  private cache: RedisCache;

  constructor() {
    const nodes = (process.env.REDIS_NODES || 'localhost:6379').split(',');
    this.cluster = createRedisCluster({
      nodes,
      keyPrefix: 'admin-svc:',
    });
    this.cache = createCache(this.cluster);
  }

  async getUser<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(`user:${key}`);
  }

  async setUser(key: string, value: unknown, ttlSeconds: number = USER_CACHE_TTL): Promise<void> {
    await this.cache.set(`user:${key}`, value, ttlSeconds);
  }

  async getUserList<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(`ulist:${key}`);
  }

  async setUserList(key: string, value: unknown, ttlSeconds: number = USER_LIST_CACHE_TTL): Promise<void> {
    await this.cache.set(`ulist:${key}`, value, ttlSeconds);
  }

  async getUserStats<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(`ustats:${key}`);
  }

  async setUserStats(key: string, value: unknown, ttlSeconds: number = USER_STATS_CACHE_TTL): Promise<void> {
    await this.cache.set(`ustats:${key}`, value, ttlSeconds);
  }

  async invalidateUser(userId: string): Promise<void> {
    await this.cache.del(`user:${userId}`);
  }

  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const result = await this.cluster.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        const pipeline = this.cluster.pipeline();
        for (const key of keys) {
          pipeline.del(key);
        }
        await pipeline.exec();
      }
    } while (cursor !== '0');
  }

  async invalidateUserLists(): Promise<void> {
    await this.deleteByPattern('admin-svc:ulist:*');
  }

  async invalidateUserStats(): Promise<void> {
    await this.deleteByPattern('admin-svc:ustats:*');
  }

  async invalidateAll(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateUser(userId),
      this.invalidateUserLists(),
      this.invalidateUserStats(),
    ]);
  }

  onModuleDestroy() {
    try {
      this.cluster.disconnect();
    } catch {}
  }

  getCluster() {
    return this.cluster;
  }
}
