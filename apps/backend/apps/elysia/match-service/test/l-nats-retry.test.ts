/**
 * nats.ts connection retry loop: transient failure then success, and the
 * exhausted-retries rejection. Uses vi.doMock plus vi.resetModules so the
 * module-level retry knobs can be tuned per evaluation without touching
 * the service's real singleton.
 */
import './helpers/env';
import { afterAll, expect, test, vi } from 'vitest';
import {
  createNatsConnection,
  IdempotencyService as RealIdempotencyService,
  JetStreamPublisher as RealJetStreamPublisher,
  generateTraceId as realGenerateTraceId,
} from '@ain-rider/nats-client';

// Current mock implementation; each test swaps it before re-importing the
// module under test. The doMock factory below always reads the latest value.
let mockCreate: typeof createNatsConnection = createNatsConnection;

vi.doMock('@ain-rider/nats-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain-rider/nats-client')>();
  return {
    ...actual,
    createNatsConnection: ((cfg: any) => mockCreate(cfg)) as typeof createNatsConnection,
  };
});

test('initNats retries a transient connection failure and then succeeds', async () => {
  let attempts = 0;
  mockCreate = (async (cfg: any) => {
    attempts++;
    if (attempts < 2) throw new Error('transient nats outage');
    return createNatsConnection(cfg);
  }) as typeof createNatsConnection;

  process.env.NATS_MAX_RETRIES = '3';
  process.env.NATS_RETRY_DELAY_MS = '10';
  vi.resetModules();
  const fresh = await import('../src/shared/nats');
  await fresh.initNats();

  expect(attempts).toBe(2);
  expect(fresh.getPublisher()).toBeDefined();
  expect(fresh.getIdempotency()).toBeInstanceOf(RealIdempotencyService);
  expect(fresh.generateTrace()).toEqual(expect.any(String));
  expect(fresh.getConnection().getServer).toBeDefined();
  await fresh.getConnection().close();
}, 20000);

test('initNats rejects after exhausting its retry budget', async () => {
  mockCreate = (async () => {
    throw new Error('nats unreachable');
  }) as typeof createNatsConnection;

  process.env.NATS_MAX_RETRIES = '2';
  process.env.NATS_RETRY_DELAY_MS = '5';
  vi.resetModules();
  const fresh = await import('../src/shared/nats');

  await expect(fresh.initNats()).rejects.toThrow('NATS connection failed after 2 attempts');
}, 20000);

test('module defaults apply when the env knobs are unset', async () => {
  let attempts = 0;
  const seenServers: string[][] = [];
  mockCreate = (async (cfg: any) => {
    attempts++;
    seenServers.push(cfg.servers);
    if (attempts < 2) throw new Error('transient nats outage');
    return createNatsConnection(cfg);
  }) as typeof createNatsConnection;

  const servers = process.env.NATS_SERVERS;
  const retries = process.env.NATS_MAX_RETRIES;
  const delay = process.env.NATS_RETRY_DELAY_MS;
  delete process.env.NATS_SERVERS;
  delete process.env.NATS_MAX_RETRIES;
  delete process.env.NATS_RETRY_DELAY_MS;
  try {
    vi.resetModules();
    const fresh = await import('../src/shared/nats');
    await fresh.initNats();

    expect(attempts).toBe(2);
    // the module default server list is nats://localhost:4222
    expect(seenServers[0]).toEqual(['nats://localhost:4222']);
    await fresh.getConnection().close();
  } finally {
    if (servers !== undefined) process.env.NATS_SERVERS = servers;
    if (retries !== undefined) process.env.NATS_MAX_RETRIES = retries;
    if (delay !== undefined) process.env.NATS_RETRY_DELAY_MS = delay;
  }
}, 20000);

test('getPublisher, getIdempotency and getConnection throw before initNats', async () => {
  vi.resetModules();
  const fresh = await import('../src/shared/nats');
  expect(() => fresh.getPublisher()).toThrow('NATS publisher not initialized');
  expect(() => fresh.getIdempotency()).toThrow('Idempotency service not initialized');
  expect(() => fresh.getConnection()).toThrow('NATS connection not initialized');
});

afterAll(async () => {
  vi.doUnmock('@ain-rider/nats-client');
  vi.resetModules();
});
