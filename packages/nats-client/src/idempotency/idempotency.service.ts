import { createClient } from 'redis';
import { Counter } from 'prom-client';

export { createClient } from 'redis';
export type { RedisClientType } from 'redis';

/**
 * Minimal interface for Redis client compatibility across different libraries.
 * 
 * Why this interface exists:
 * 1. Library Agnosticism: Works with both `node-redis` (v4+) and `ioredis`.
 * 2. Overload Handling: `ioredis` uses many overloads (separate signatures for string vs string[]),
 *    while `node-redis` uses unions. Overloading here mirrors ioredis exactly to satisfy its 
 *    strict type checking without using 'any'.
 */
export interface RedisClientLike {
  /** Checks if key(s) exist. Overloaded to support both single and batch checks. */
  exists(key: string): Promise<number | boolean>;
  exists(keys: string[]): Promise<number | boolean>;

  /** setEx is used by node-redis (camelCase), setex is used by ioredis (lowercase). */
  setEx?(key: string, ttl: number, value: string): Promise<unknown>;
  setex?(key: string, ttl: number, value: string): Promise<unknown>;

  /** set supports various overloads for setting values with optional flags like EX (expiry). */
  set(key: string, value: string): Promise<unknown>;
  set(key: string, value: string, flag: string, duration: number): Promise<unknown>;

  get(key: string): Promise<string | null>;

  /** Removes key(s). Overloaded to support both single and batch deletions. */
  del(key: string): Promise<number>;
  del(keys: string[]): Promise<number>;

  connect?(): unknown;
  disconnect?(): unknown;
  quit?(): unknown;

  /** Cluster status (ioredis) or open state (node-redis) */
  readonly status?: string;
  readonly isOpen?: boolean;
}

export interface IdempotencyConfig {
  redisUrl?: string;
  keyPrefix?: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL = 7 * 24 * 60 * 60;

const idempotencyCacheTotal = new Counter({
  name: 'idempotency_cache_total',
  help: 'Idempotency cache hit/miss counter',
  labelNames: ['result'],
});

/**
 * Service to handle idempotency using a Redis backend.
 * Ensures that specific events or requests are only processed once.
 */
export class IdempotencyService {
  private redis: RedisClientLike;
  private keyPrefix: string;
  private ttlSeconds: number;

  constructor(
    redisClient?: RedisClientLike,
    config?: IdempotencyConfig
  ) {
    this.redis = redisClient ?? (createClient({
      url: config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    }) as unknown as RedisClientLike);
    this.keyPrefix = config?.keyPrefix || 'idempotency';
    this.ttlSeconds = config?.ttlSeconds || DEFAULT_TTL;
  }

  /**
   * Establishes connection to Redis if not already connected.
   */
  async connect(): Promise<void> {
    const status = this.redis.status || this.redis.isOpen;
    if (status !== 'ready' && status !== true && typeof this.redis.connect === 'function') {
      try {
        await this.redis.connect!();
        console.log('[IdempotencyService] Connected to Redis');
      } catch (err) {
        if (!String(err).includes('already')) throw err;
      }
    }
  }

  /**
   * Gracefully closes the Redis connection.
   */
  async disconnect(): Promise<void> {
    if (typeof this.redis.disconnect === 'function') {
      await this.redis.disconnect!();
    } else if (typeof this.redis.quit === 'function') {
      await this.redis.quit!();
    }
  }

  /**
   * Checks if an event with the given ID has already been marked as processed.
   */
  async isProcessed(consumerName: string, eventId: string): Promise<boolean> {
    const key = this.buildKey(consumerName, eventId);
    const exists = await this.redis.exists(key);
    const hit = exists === 1 || exists === true;
    idempotencyCacheTotal.inc({ result: hit ? 'hit' : 'miss' });
    return hit;
  }

  /**
   * Marks an event as processed with a TTL.
   */
  async markProcessed(consumerName: string, eventId: string): Promise<void> {
    const key = this.buildKey(consumerName, eventId);
    // Prefer setEx/setex if available, otherwise fallback to raw set with flags
    if (typeof this.redis.setEx === 'function') {
      await this.redis.setEx!(key, this.ttlSeconds, '1');
    } else if (typeof this.redis.setex === 'function') {
      await this.redis.setex!(key, this.ttlSeconds, '1');
    } else {
      await this.redis.set(key, '1', 'EX', this.ttlSeconds);
    }
  }

  /**
   * Retrieves data associated with a processed event.
   */
  async get(consumerName: string, eventId: string): Promise<string | null> {
    const key = this.buildKey(consumerName, eventId);
    return this.redis.get(key);
  }

  /**
   * Removes an event from the idempotency cache.
   */
  async delete(consumerName: string, eventId: string): Promise<number> {
    const key = this.buildKey(consumerName, eventId);
    return this.redis.del(key);
  }

  private buildKey(consumerName: string, eventId: string): string {
    return `${this.keyPrefix}:${consumerName}:${eventId}`;
  }

  /**
   * Returns the underlying Redis client instance.
   */
  getRedisClient(): RedisClientLike {
    return this.redis;
  }
}

export function createIdempotencyService(
  redisClient?: RedisClientLike,
  config?: IdempotencyConfig
): IdempotencyService {
  return new IdempotencyService(redisClient, config);
}
