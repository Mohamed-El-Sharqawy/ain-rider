import { afterAll, describe, expect, test, vi } from 'vitest';
import {
  IdempotencyService,
  createIdempotencyService,
} from '../src/idempotency/idempotency.service';
import {
  EnvSaver,
  InMemoryRedis,
  findRedisOwnerUrl,
  uniqueId,
} from './helpers';

describe('IdempotencyService (unit, in-memory redis)', () => {
  test('isProcessed is false on a miss and true after markProcessed', async () => {
    const redis = new InMemoryRedis();
    const service = new IdempotencyService(redis, {
      keyPrefix: 'w10-idem',
      ttlSeconds: 60,
    });

    await expect(service.isProcessed('consumer-a', 'evt-1')).resolves.toBe(false);
    await service.markProcessed('consumer-a', 'evt-1');
    await expect(service.isProcessed('consumer-a', 'evt-1')).resolves.toBe(true);

    expect(redis.store.get('w10-idem:consumer-a:evt-1')).toBe('1');
    expect(redis.lastCall('setEx')!.args).toEqual([
      'w10-idem:consumer-a:evt-1',
      60,
      '1',
    ]);
  });

  test('uses the setex fallback when setEx is not supported', async () => {
    const redis = new InMemoryRedis().disableSetEx();
    const service = new IdempotencyService(redis, { keyPrefix: 'w10' });
    await service.markProcessed('c', 'e');
    expect(redis.lastCall('setex')!.args).toEqual(['w10:c:e', 7 * 24 * 60 * 60, '1']);
  });

  test('falls back to raw SET with EX flags when neither setEx nor setex exists', async () => {
    const redis = new InMemoryRedis().disableSetEx().disableSetex();
    const service = new IdempotencyService(redis, { keyPrefix: 'w10' });
    await service.markProcessed('c', 'e');
    const call = redis.lastCall('set')!;
    expect(call.args[0]).toBe('w10:c:e');
    expect(call.args[1]).toBe('1');
    expect(call.args[2]).toBe('EX');
    expect(call.args[3]).toBe(7 * 24 * 60 * 60);
  });

  test('defaults the ttl to seven days', async () => {
    const redis = new InMemoryRedis();
    const service = new IdempotencyService(redis);
    await service.markProcessed('c', 'e');
    expect(redis.lastCall('setEx')!.args[1]).toBe(7 * 24 * 60 * 60);
  });

  test('get returns the stored value and delete removes it', async () => {
    const redis = new InMemoryRedis();
    const service = new IdempotencyService(redis, { keyPrefix: 'pfx' });
    await service.markProcessed('cons', 'evt');
    await expect(service.get('cons', 'evt')).resolves.toBe('1');
    await expect(service.delete('cons', 'evt')).resolves.toBe(1);
    await expect(service.get('cons', 'evt')).resolves.toBeNull();
    await expect(service.isProcessed('cons', 'evt')).resolves.toBe(false);
  });

  test('getRedisClient exposes the underlying client', () => {
    const redis = new InMemoryRedis();
    const service = new IdempotencyService(redis);
    expect(service.getRedisClient()).toBe(redis);
  });

  describe('connect()', () => {
    test('skips connecting when status is already ready', async () => {
      const redis = new InMemoryRedis();
      redis.status = 'ready';
      const service = new IdempotencyService(redis);
      await service.connect();
      expect(redis.lastCall('connect')).toBeUndefined();
    });

    test('skips connecting when isOpen is true', async () => {
      const redis = new InMemoryRedis();
      redis.isOpen = true;
      const service = new IdempotencyService(redis);
      await service.connect();
      expect(redis.lastCall('connect')).toBeUndefined();
    });

    test('skips connecting when the client has no connect function', async () => {
      const redis = new InMemoryRedis();
      redis.status = 'connecting';
      (redis as unknown as { connect?: unknown }).connect = undefined;
      const service = new IdempotencyService(redis);
      await service.connect();
      expect(redis.lastCall('connect')).toBeUndefined();
    });

    test('connects when the client is not ready', async () => {
      const redis = new InMemoryRedis();
      redis.status = 'connecting';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const service = new IdempotencyService(redis);
      await service.connect();
      expect(redis.lastCall('connect')).toBeDefined();
      logSpy.mockRestore();
    });

    test('swallows "already connected" errors', async () => {
      const redis = new InMemoryRedis();
      redis.connectError = new Error('Connection already enabled');
      const service = new IdempotencyService(redis);
      await expect(service.connect()).resolves.toBeUndefined();
    });

    test('rethrows other connect errors', async () => {
      const redis = new InMemoryRedis();
      redis.connectError = new Error('ECONNREFUSED');
      const service = new IdempotencyService(redis);
      await expect(service.connect()).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('disconnect()', () => {
    test('prefers disconnect', async () => {
      const redis = new InMemoryRedis();
      const service = new IdempotencyService(redis);
      await service.disconnect();
      expect(redis.lastCall('disconnect')).toBeDefined();
      expect(redis.lastCall('quit')).toBeUndefined();
    });

    test('falls back to quit when disconnect is missing', async () => {
      const redis = new InMemoryRedis();
      (redis as unknown as { disconnect?: unknown }).disconnect = undefined;
      const service = new IdempotencyService(redis);
      await service.disconnect();
      expect(redis.lastCall('quit')).toBeDefined();
    });

    test('is a no-op without disconnect or quit', async () => {
      const redis = new InMemoryRedis();
      (redis as unknown as { disconnect?: unknown }).disconnect = undefined;
      (redis as unknown as { quit?: unknown }).quit = undefined;
      const service = new IdempotencyService(redis);
      await expect(service.disconnect()).resolves.toBeUndefined();
    });
  });

  test('constructs a default redis client from config or env', () => {
    const env = new EnvSaver();
    try {
      env.set('REDIS_URL', undefined);
      const fromConfig = new IdempotencyService(undefined, {
        redisUrl: 'redis://config-host:6379',
      });
      expect(fromConfig.getRedisClient()).toBeTruthy();

      env.set('REDIS_URL', undefined);
      const fromDefault = new IdempotencyService();
      expect(fromDefault.getRedisClient()).toBeTruthy();

      env.set('REDIS_URL', 'redis://env-host:6379');
      const fromEnv = new IdempotencyService();
      expect(fromEnv.getRedisClient()).toBeTruthy();

      const factory = createIdempotencyService(new InMemoryRedis());
      expect(factory.getRedisClient()).toBeInstanceOf(InMemoryRedis);
    } finally {
      env.restore();
    }
  });
});

describe('IdempotencyService (integration, redis cluster)', () => {
  let service: IdempotencyService;

  afterAll(async () => {
    if (service) {
      await service.disconnect().catch(() => undefined);
    }
  });

  test('stores idempotency keys on the cluster node that owns them', async () => {
    const tag = uniqueId('w10tag');
    const ownerUrl = await findRedisOwnerUrl(tag);
    service = new IdempotencyService(undefined, {
      redisUrl: ownerUrl,
      keyPrefix: 'w10-idem-itest',
      ttlSeconds: 120,
    });
    await service.connect();

    const consumerName = `{${tag}}-consumer`;
    await expect(service.isProcessed(consumerName, 'evt-itest')).resolves.toBe(false);
    await service.markProcessed(consumerName, 'evt-itest');
    await expect(service.isProcessed(consumerName, 'evt-itest')).resolves.toBe(true);
    await expect(service.get(consumerName, 'evt-itest')).resolves.toBe('1');
    await expect(service.delete(consumerName, 'evt-itest')).resolves.toBe(1);
    await expect(service.isProcessed(consumerName, 'evt-itest')).resolves.toBe(false);
  });
});
