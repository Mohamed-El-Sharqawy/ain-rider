import { afterAll, describe, expect, test } from 'vitest';
import {
  createNatsConnection,
  getNatsServersFromEnv,
} from '../src/connection';
import { EnvSaver, connectTestNats } from './helpers';

describe('getNatsServersFromEnv', () => {
  test('parses NATS_SERVERS into a trimmed list', () => {
    const env = new EnvSaver();
    try {
      env.set('NATS_SERVERS', 'nats://a:4222, nats://b:4222 ,nats://c:4222');
      env.set('NATS_URL', undefined);
      expect(getNatsServersFromEnv()).toEqual([
        'nats://a:4222',
        'nats://b:4222',
        'nats://c:4222',
      ]);
    } finally {
      env.restore();
    }
  });

  test('falls back to NATS_URL when NATS_SERVERS is unset', () => {
    const env = new EnvSaver();
    try {
      env.set('NATS_SERVERS', undefined);
      env.set('NATS_URL', 'nats://single:4222');
      expect(getNatsServersFromEnv()).toEqual(['nats://single:4222']);
    } finally {
      env.restore();
    }
  });

  test('defaults to localhost:4222 when nothing is set', () => {
    const env = new EnvSaver();
    try {
      env.set('NATS_SERVERS', undefined);
      env.set('NATS_URL', undefined);
      expect(getNatsServersFromEnv()).toEqual(['nats://localhost:4222']);
    } finally {
      env.restore();
    }
  });
});

describe('createNatsConnection', () => {
  const connections: Awaited<ReturnType<typeof createNatsConnection>>[] = [];

  afterAll(async () => {
    for (const nc of connections.splice(0)) {
      await nc.drain().catch(() => undefined);
    }
  });

  test('prefers explicit servers over url and env', async () => {
    const env = new EnvSaver();
    env.set('NATS_SERVERS', 'nats://localhost:59991');
    try {
      const nc = await createNatsConnection({
        servers: ['nats://localhost:4222'],
        url: 'nats://localhost:59992',
        name: 'w10-priority',
      });
      connections.push(nc);
      expect(nc.isClosed()).toBe(false);
    } finally {
      env.restore();
    }
  });

  test('prefers url over NATS_SERVERS env', async () => {
    const env = new EnvSaver();
    env.set('NATS_SERVERS', 'nats://localhost:59991');
    try {
      const nc = await createNatsConnection({
        url: 'nats://localhost:4223',
        name: 'w10-url-priority',
      });
      connections.push(nc);
      expect(nc.isClosed()).toBe(false);
    } finally {
      env.restore();
    }
  });

  test('uses NATS_SERVERS env when no config is given', async () => {
    const env = new EnvSaver();
    env.set('NATS_SERVERS', 'nats://localhost:4222,nats://localhost:4223');
    try {
      const nc = await createNatsConnection();
      connections.push(nc);
      expect(nc.isClosed()).toBe(false);
    } finally {
      env.restore();
    }
  });

  test('rejects when no server is reachable', async () => {
    const nc = createNatsConnection({
      servers: ['nats://localhost:59999'],
      name: 'w10-unreachable',
      maxReconnectAttempts: 1,
      reconnectTimeWait: 50,
    });
    await expect(nc).rejects.toThrow();
  });

  test('integration helper connects to the docker cluster', async () => {
    const nc = await connectTestNats('connection');
    connections.push(nc);
    expect(nc.getServer()).toMatch(/localhost:422[234]/);
  });
});
