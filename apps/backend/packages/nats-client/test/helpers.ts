/**
 * Shared helpers for the nats-client test suite.
 *
 * Integration tests run against the docker NATS 3-node cluster and the
 * docker redis cluster. All JetStream state created by tests is
 * test-scoped (W10_* streams, w10.* subjects) and deleted on cleanup.
 * Shared streams (AIN_RIDER_*) are only created if missing, never
 * updated or deleted; individual test messages published to them are
 * removed again by stream sequence.
 */

import {
  connect,
  NatsConnection,
  JetStreamManager,
  StorageType,
  RetentionPolicy,
} from 'nats';
import { createClient } from 'redis';
import type { RedisClientLike } from '../src/idempotency';
import type { SendToDLQOptions } from '../src/dlq/dlq.service';
import type { DLQService } from '../src/dlq/dlq.service';

export const NATS_SERVERS = (
  process.env.NATS_SERVERS ||
  'nats://localhost:4222,nats://localhost:4223,nats://localhost:4224'
)
  .split(',')
  .map((s) => s.trim());

export async function connectTestNats(name: string): Promise<NatsConnection> {
  return connect({
    servers: NATS_SERVERS,
    name: `w10-test-${name}`,
    maxReconnectAttempts: 5,
    reconnectTimeWait: 250,
  });
}

let tagCounter = 0;

export function uniqueId(prefix = 'w10'): string {
  tagCounter += 1;
  return `${prefix}${Date.now().toString(36)}${tagCounter.toString(36)}`;
}

/** Create a test-scoped stream. Fails loudly if the name already exists. */
export async function createTestStream(
  jsm: JetStreamManager,
  name: string,
  subjects: string[],
): Promise<void> {
  await jsm.streams.add({
    name,
    subjects,
    storage: StorageType.Memory,
    retention: RetentionPolicy.Limits,
    num_replicas: 1,
  });
}

export async function deleteStreamQuietly(
  jsm: JetStreamManager,
  name: string,
): Promise<void> {
  try {
    await jsm.streams.delete(name);
  } catch {
    // already gone
  }
}

/**
 * Create a shared stream ONLY if it does not exist yet. Never updates or
 * deletes shared state; returns true when this call created it.
 */
export async function ensureSharedStream(
  jsm: JetStreamManager,
  name: string,
  subjects: string[],
): Promise<boolean> {
  try {
    await jsm.streams.info(name);
    return false;
  } catch {
    await jsm.streams.add({
      name,
      subjects,
      storage: StorageType.File,
      retention: RetentionPolicy.Limits,
    });
    return true;
  }
}

export async function waitFor(
  fn: () => Promise<boolean> | boolean,
  timeoutMs = 10_000,
  intervalMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let ok = false;
    try {
      ok = await fn();
    } catch {
      ok = false;
    }
    if (ok) return;
    if (Date.now() > deadline) {
      throw new Error('waitFor timed out');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Find the redis cluster node that owns the given hash tag so a plain
 * standalone client (what IdempotencyService creates) can serve keys
 * with that tag without MOVED redirects.
 */
export async function findRedisOwnerUrl(tag: string): Promise<string> {
  const probeKey = `idempotency:{${tag}}:probe`;
  for (const port of [6379, 6380, 6381, 6382, 6383, 6384]) {
    const client = createClient({
      url: `redis://localhost:${port}`,
      socket: { reconnectStrategy: false },
    });
    try {
      await client.connect();
      await client.exists(probeKey);
      await client.disconnect();
      return `redis://localhost:${port}`;
    } catch {
      try {
        await client.disconnect();
      } catch {
        // not connected
      }
    }
  }
  throw new Error(
    'no redis node owns the probe key; is the docker redis cluster up?',
  );
}

/**
 * In-memory RedisClientLike fake covering the full IdempotencyService
 * surface plus switches to force every fallback branch.
 */
export class InMemoryRedis implements RedisClientLike {
  store = new Map<string, string>();
  calls: { op: string; args: unknown[] }[] = [];
  status?: string;
  isOpen?: boolean;
  supportsSetEx = true;
  supportsSetex = true;
  connectError?: Error;
  connectShouldThrow = false;

  async exists(key: string): Promise<number>;
  async exists(keys: string[]): Promise<number>;
  async exists(key: string | string[]): Promise<number> {
    this.calls.push({ op: 'exists', args: [key] });
    if (Array.isArray(key)) {
      return key.filter((k) => this.store.has(k)).length;
    }
    return this.store.has(key) ? 1 : 0;
  }

  async setEx(key: string, ttl: number, value: string): Promise<unknown> {
    this.calls.push({ op: 'setEx', args: [key, ttl, value] });
    if (!this.supportsSetEx) {
      throw new Error('setEx is not supported by this fake');
    }
    this.store.set(key, value);
    return 'OK';
  }

  async setex(key: string, ttl: number, value: string): Promise<unknown> {
    this.calls.push({ op: 'setex', args: [key, ttl, value] });
    if (!this.supportsSetex) {
      throw new Error('setex is not supported by this fake');
    }
    this.store.set(key, value);
    return 'OK';
  }

  async set(key: string, value: string): Promise<unknown>;
  async set(
    key: string,
    value: string,
    flag: string,
    duration: number,
  ): Promise<unknown>;
  async set(
    key: string,
    value: string,
    flag?: string,
    duration?: number,
  ): Promise<unknown> {
    this.calls.push({ op: 'set', args: [key, value, flag, duration] });
    this.store.set(key, value);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    this.calls.push({ op: 'get', args: [key] });
    return this.store.get(key) ?? null;
  }

  async del(key: string): Promise<number>;
  async del(keys: string[]): Promise<number>;
  async del(key: string | string[]): Promise<number> {
    this.calls.push({ op: 'del', args: [key] });
    if (Array.isArray(key)) {
      let n = 0;
      for (const k of key) {
        n += this.store.delete(k) ? 1 : 0;
      }
      return n;
    }
    return this.store.delete(key) ? 1 : 0;
  }

  async connect(): Promise<unknown> {
    this.calls.push({ op: 'connect', args: [] });
    if (this.connectError) throw this.connectError;
    this.status = 'ready';
    return 'OK';
  }

  async disconnect(): Promise<unknown> {
    this.calls.push({ op: 'disconnect', args: [] });
    return 'OK';
  }

  async quit(): Promise<unknown> {
    this.calls.push({ op: 'quit', args: [] });
    return 'OK';
  }

  /** Shadow setEx with undefined so the service takes the setex fallback. */
  disableSetEx(): this {
    (this as unknown as { setEx?: unknown }).setEx = undefined;
    return this;
  }

  /** Shadow setex with undefined so the service takes the raw SET fallback. */
  disableSetex(): this {
    (this as unknown as { setex?: unknown }).setex = undefined;
    return this;
  }

  lastCall(op: string): { op: string; args: unknown[] } | undefined {
    for (let i = this.calls.length - 1; i >= 0; i -= 1) {
      if (this.calls[i]!.op === op) return this.calls[i];
    }
    return undefined;
  }
}

/** Minimal in-memory double for the DLQService seam. */
export class RecordingDLQService {
  calls: SendToDLQOptions[] = [];

  async sendToDLQ(options: SendToDLQOptions): Promise<void> {
    this.calls.push(options);
  }

  asDLQService(): DLQService {
    return this as unknown as DLQService;
  }
}

/** Save process.env keys and restore them after the test. */
export class EnvSaver {
  private saved = new Map<string, string | undefined>();

  set(key: string, value: string | undefined): void {
    if (!this.saved.has(key)) {
      this.saved.set(key, process.env[key]);
    }
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  restore(): void {
    for (const [key, value] of this.saved.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    this.saved.clear();
  }
}
