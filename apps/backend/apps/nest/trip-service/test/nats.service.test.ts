/**
 * NatsService unit suite.
 *
 * nats-client and redis-client are mocked at the module boundary; the suite
 * pins connection setup, accessor wiring and every graceful-shutdown branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  nc: { drain: vi.fn().mockResolvedValue(undefined) } as any,
  publisher: { publishCore: true },
  responder: {
    close: vi.fn().mockResolvedValue(undefined),
  } as any,
  jsPublisher: { publishJs: true },
  idempotency: { markProcessed: vi.fn() },
  redis: { quit: vi.fn() },
}));

vi.mock('@ain-rider/nats-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain-rider/nats-client')>();
  return {
    ...actual,
    createNatsConnection: vi.fn().mockResolvedValue(fakes.nc),
    createPublisher: vi.fn().mockReturnValue(fakes.publisher),
    createResponder: vi.fn().mockReturnValue(fakes.responder),
    JetStreamPublisher: class {
      constructor(public nc: unknown, public serviceName: string) {}
    },
    IdempotencyService: class {
      constructor(public redis: unknown) {}
    },
  };
});

vi.mock('@ain-rider/redis-client', () => ({
  createRedisCluster: vi.fn().mockReturnValue(fakes.redis),
}));

import { NatsService } from '../src/shared/nats/nats.service';

beforeEach(() => {
  vi.clearAllMocks();
  fakes.responder.close.mockResolvedValue(undefined);
  fakes.nc.drain.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NatsService', () => {
  it('onModuleInit connects and wires publisher/responder/js/idempotency', async () => {
    process.env.NATS_SERVERS = 'nats://n1:4222,nats://n2:4222';
    process.env.REDIS_NODES = 'r1:6379,r2:6379';
    const svc = new NatsService();
    await svc.onModuleInit();

    expect(svc.publisher).toBe(fakes.publisher);
    expect(svc.responder).toBe(fakes.responder);
    expect(svc.jsPublisher).toBeInstanceOf(Object);
    expect(svc.idempotency).toBeInstanceOf(Object);
    expect(svc.nc).toBe(fakes.nc);
  });

  it('onModuleInit falls back to single-node defaults when the cluster env is unset', async () => {
    delete process.env.NATS_SERVERS;
    delete process.env.REDIS_NODES;
    const svc = new NatsService();
    await svc.onModuleInit();

    const { createNatsConnection } = await import('@ain-rider/nats-client');
    expect(createNatsConnection).toHaveBeenCalledWith({
      servers: ['nats://localhost:4222'],
      name: 'trip-service',
    });
    const { createRedisCluster } = await import('@ain-rider/redis-client');
    expect(createRedisCluster).toHaveBeenCalledWith({ nodes: ['localhost:6379'] });
    expect(svc.nc).toBe(fakes.nc);
  });

  it('graceful shutdown closes the responder, waits and drains the connection', async () => {
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const svc = new NatsService();
    await svc.onModuleInit();

    const done = svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;

    expect(fakes.responder.close).toHaveBeenCalled();
    expect(fakes.nc.drain).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[NATS] Graceful shutdown complete');
  });

  it('a second shutdown attempt returns immediately', async () => {
    vi.useFakeTimers();
    const svc = new NatsService();
    await svc.onModuleInit();

    const first = svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1_000);
    await first;
    expect(fakes.responder.close).toHaveBeenCalledTimes(1);

    await svc.onModuleDestroy();
    expect(fakes.responder.close).toHaveBeenCalledTimes(1);
  });

  it('survives a responder close failure and still drains', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fakes.responder.close.mockRejectedValue(new Error('close boom'));
    const svc = new NatsService();
    await svc.onModuleInit();

    const done = svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;

    expect(errorSpy).toHaveBeenCalledWith('[NATS] Error closing responder:', expect.any(Error));
    expect(fakes.nc.drain).toHaveBeenCalled();
  });

  it('survives a drain failure', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fakes.nc.drain.mockRejectedValue(new Error('drain boom'));
    const svc = new NatsService();
    await svc.onModuleInit();

    const done = svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;

    expect(errorSpy).toHaveBeenCalledWith('[NATS] Error draining connection:', expect.any(Error));
  });

  it('shutdown before init skips the responder and connection steps', async () => {
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const svc = new NatsService();

    const done = svc.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(1_000);
    await done;

    expect(fakes.responder.close).not.toHaveBeenCalled();
    expect(fakes.nc.drain).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[NATS] Graceful shutdown complete');
  });
});
