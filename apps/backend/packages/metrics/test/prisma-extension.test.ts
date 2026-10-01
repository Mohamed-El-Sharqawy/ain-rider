import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { dbQueryDuration } from '../src';
import { prismaMetricsExtension, prismaMetricsMiddleware } from '../src/prisma-extension';

describe('prismaMetricsExtension $allOperations', () => {
  let observe: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    observe = vi.spyOn(dbQueryDuration, 'observe').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('runs the query and observes its duration in seconds with model labels', async () => {
    const extension = prismaMetricsExtension('trip-service');
    const query = vi.fn(async (args: unknown) => ({ count: args }));

    const result = await extension.query.$allOperations({
      model: 'Trip',
      operation: 'findMany',
      args: { take: 5 },
      query,
    });

    expect(result).toEqual({ count: { take: 5 } });
    expect(query).toHaveBeenCalledWith({ take: 5 });
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'trip-service', model: 'Trip', operation: 'findMany' },
      expect.any(Number),
    );
    expect(observe.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
  });

  test('reports the none model for operations without a model', async () => {
    const extension = prismaMetricsExtension('auth-service');

    await extension.query.$allOperations({
      model: undefined,
      operation: 'queryRaw',
      args: {},
      query: async () => [],
    });

    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'auth-service', model: 'none', operation: 'queryRaw' },
      expect.any(Number),
    );
  });

  test('still observes the duration when the query rejects and rethrows the error', async () => {
    const extension = prismaMetricsExtension('payment-service');
    const failure = new Error('connection terminated');

    const pending = extension.query.$allOperations({
      model: 'Payment',
      operation: 'create',
      args: {},
      query: async () => {
        throw failure;
      },
    });

    await expect(pending).rejects.toBe(failure);
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'payment-service', model: 'Payment', operation: 'create' },
      expect.any(Number),
    );
  });
});

describe('prismaMetricsMiddleware', () => {
  let observe: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    observe = vi.spyOn(dbQueryDuration, 'observe').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('awaits the next middleware and observes its duration with action labels', async () => {
    const middleware = prismaMetricsMiddleware('auth-service');
    const next = vi.fn(async () => 'result');

    const result = await middleware({ model: 'User', action: 'findFirst' }, next);

    expect(result).toBe('result');
    expect(next).toHaveBeenCalledWith({ model: 'User', action: 'findFirst' });
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'auth-service', model: 'User', operation: 'findFirst' },
      expect.any(Number),
    );
  });

  test('reports the none model when params carry no model', async () => {
    const middleware = prismaMetricsMiddleware('admin-service');

    await middleware({ action: 'runCommandRaw' }, async () => null);

    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'admin-service', model: 'none', operation: 'runCommandRaw' },
      expect.any(Number),
    );
  });

  test('still observes the duration when the next middleware rejects and rethrows', async () => {
    const middleware = prismaMetricsMiddleware('trip-service');
    const failure = new Error('write conflict');

    const pending = middleware({ model: 'Driver', action: 'update' }, async () => {
      throw failure;
    });

    await expect(pending).rejects.toBe(failure);
    expect(observe).toHaveBeenCalledExactlyOnceWith(
      { service: 'trip-service', model: 'Driver', operation: 'update' },
      expect.any(Number),
    );
  });
});
