/**
 * Idempotency Service
 * 
 * Prevents duplicate event processing using Redis
 * Key format: idempotency:{consumerName}:{eventId}
 * TTL: 7 days
 */

import { createClient } from 'redis';
import type { RedisClientType as RedisClient } from 'redis';

// Re-export for convenience so consumers don't need direct redis import
export { createClient } from 'redis';
export type { RedisClientType } from 'redis';

export interface IdempotencyConfig {
  /** Redis URL (default: from REDIS_URL env var) */
  redisUrl?: string;
  
  /** Key prefix (default: 'idempotency') */
  keyPrefix?: string;
  
  /** TTL in seconds (default: 7 days) */
  ttlSeconds?: number;
}

const DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days

export class IdempotencyService {
  private redis: RedisClient | any; // Use any to avoid type incompatibility
  private keyPrefix: string;
  private ttlSeconds: number;

  constructor(
    redisClient?: RedisClient | any,
    config?: IdempotencyConfig
  ) {
    this.redis = redisClient || createClient({
      url: config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    });
    this.keyPrefix = config?.keyPrefix || 'idempotency';
    this.ttlSeconds = config?.ttlSeconds || DEFAULT_TTL;
  }

  /**
   * Connect to Redis if not already connected
   */
  async connect(): Promise<void> {
    // Standard redis client uses isOpen, ioredis uses status
    const status = (this.redis as any).status || (this.redis as any).isOpen;
    if (status !== 'ready' && status !== true && typeof this.redis.connect === 'function') {
      try {
        await this.redis.connect();
        console.log('[IdempotencyService] Connected to Redis');
      } catch (err) {
        // Ignore "already connected" errors for ioredis
        if (!String(err).includes('already')) throw err;
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (typeof this.redis.disconnect === 'function') {
      await this.redis.disconnect();
    } else if (typeof this.redis.quit === 'function') {
      await this.redis.quit();
    }
  }

  /**
   * Check if an event has already been processed
   * 
   * @param consumerName - Name of the consumer
   * @param eventId - Unique event ID
   * @returns true if already processed, false otherwise
   */
  async isProcessed(consumerName: string, eventId: string): Promise<boolean> {
    const key = this.buildKey(consumerName, eventId);
    const exists = await this.redis.exists(key);
    return exists === 1 || exists === true;
  }

  /**
   * Mark an event as processed
   * 
   * @param consumerName - Name of the consumer
   * @param eventId - Unique event ID
   */
  async markProcessed(consumerName: string, eventId: string): Promise<void> {
    const key = this.buildKey(consumerName, eventId);
    
    // ioredis uses setex(key, ttl, value)
    // node-redis uses setEx(key, ttl, value)
    if (typeof this.redis.setEx === 'function') {
      await this.redis.setEx(key, this.ttlSeconds, '1');
    } else if (typeof this.redis.setex === 'function') {
      await this.redis.setex(key, this.ttlSeconds, '1');
    } else {
      // Fallback for other potential client versions
      await this.redis.set(key, '1', 'EX', this.ttlSeconds);
    }
  }

  /**
   * Build Redis key for idempotency check
   */
  private buildKey(consumerName: string, eventId: string): string {
    return `${this.keyPrefix}:${consumerName}:${eventId}`;
  }

  /**
   * Get the underlying Redis client for advanced operations
   */
  getRedisClient(): RedisClient | any {
    return this.redis;
  }
}

/**
 * Factory function to create an IdempotencyService
 */
export function createIdempotencyService(
  redisClient?: RedisClient | any,
  config?: IdempotencyConfig
): IdempotencyService {
  return new IdempotencyService(redisClient, config);
}
