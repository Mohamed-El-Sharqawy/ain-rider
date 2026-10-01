import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { NatsConnection, JetStreamManager } from 'nats';
import {
  StreamManager,
  createStreamManager,
} from '../src/jetstream/stream-manager';
import {
  connectTestNats,
  createTestStream,
  deleteStreamQuietly,
  ensureSharedStream,
  uniqueId,
} from './helpers';

/** Minimal JetStreamManager double used only to force error branches. */
function fakeManager(overrides: {
  info?: (name: string) => Promise<unknown>;
  update?: (name: string, config: unknown) => Promise<unknown>;
  add?: (config: unknown) => Promise<unknown>;
  list?: () => { next: () => Promise<unknown[]> };
}) {
  return {
    streams: {
      info: overrides.info ?? (async () => ({})),
      update: overrides.update ?? (async () => ({})),
      add: overrides.add ?? (async () => ({})),
      list:
        overrides.list ??
        (() => ({
          next: async () => [],
        })),
    },
  } as unknown as JetStreamManager;
}

function notFound(): Error {
  return new Error('stream not found (10059)');
}

function overlapError(): Error {
  const err = new Error(
    'subjects overlap with an existing stream',
  ) as Error & { api_error?: { err_code: number } };
  err.api_error = { err_code: 10065 };
  return err;
}
describe('StreamManager', () => {
  let nc: NatsConnection;
  let jsm: JetStreamManager;
  const tag = uniqueId('sm');
  const suffix = tag.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const baseSubject = `w10.sm.${tag}`;
  const streamA = `W10_SM_A_${suffix}`;
  // mixed subjects exercise every subjectsOverlap branch during resolution:
  // token mismatch (false), prefix length mismatch (false), exact equality
  // (true) and wildcard overlap (true).
  const streamASubjects = [
    'w10.sm.unrelated.echo',
    baseSubject,
    `${baseSubject}.a`,
    `${baseSubject}.exact`,
  ];

  beforeAll(async () => {
    nc = await connectTestNats('sm');
    jsm = await nc.jetstreamManager();
    // make sure the shared streams this suite inspects exist (create-only)
    await ensureSharedStream(jsm, 'AIN_RIDER_DLQ', ['ain_rider.dlq.*']);
    // sweep leftover test-scoped streams from crashed earlier runs
    const streams = await jsm.streams.list().next();
    for (const info of streams) {
      if (info.config.name.startsWith('W10_SM_')) {
        await deleteStreamQuietly(jsm, info.config.name);
      }
    }
  });

  afterAll(async () => {
    if (nc) {
      const streams = await jsm.streams.list().next();
      for (const info of streams) {
        if (info.config.name.startsWith('W10_SM_')) {
          await deleteStreamQuietly(jsm, info.config.name);
        }
      }
      await nc.drain().catch(() => undefined);
    }
  });

  test('creates a stream idempotently and updates it on the second call', async () => {
    const manager = createStreamManager(nc);
    expect(manager).toBeInstanceOf(StreamManager);

    await manager.ensureStream(streamA, {
      subjects: streamASubjects,
      storage: 'memory',
      retention: 'limits',
      replicas: 1,
    });
    const info = await jsm.streams.info(streamA);
    expect(info.config.subjects).toEqual(expect.arrayContaining(streamASubjects));

    // second call takes the update path
    await manager.ensureStream(streamA, {
      subjects: streamASubjects,
      storage: 'memory',
      replicas: 1,
    });
    const updated = await jsm.streams.info(streamA);
    expect(updated.config.subjects).toEqual(expect.arrayContaining(streamASubjects));
  });

  test('lists stream names', async () => {
    const manager = new StreamManager(nc);
    const names = await manager.listStreams();
    expect(names).toContain(streamA);
    expect(names).toContain('AIN_RIDER_DLQ');
  });

  test('merges subjects into the first overlapping stream on 10065', async () => {
    const manager = new StreamManager(nc);

    // exact-subject request overlapping A's identical subject: resolution
    // merges into A (a no-op merge) and no stream is created
    const streamD = `W10_SM_D_${suffix}`;
    await manager.ensureStream(streamD, {
      subjects: [`${baseSubject}.exact`],
      storage: 'memory',
      replicas: 1,
    });
    const before = await jsm.streams.info(streamA);
    expect(before.config.subjects).toContain(`${baseSubject}.exact`);
    expect(before.config.subjects).toContain(`${baseSubject}.a`);
    await expect(jsm.streams.info(streamD)).rejects.toThrow();

    // wildcard '*' request overlaps A's exact subjects; resolution merges
    // into A, dropping the exact subjects the wildcard subsumes
    const streamC = `W10_SM_C_${suffix}`;
    await manager.ensureStream(streamC, {
      subjects: [`${baseSubject}.*`],
      storage: 'memory',
      replicas: 1,
    });
    const a = await jsm.streams.info(streamA);
    expect(a.config.subjects).toContain(`${baseSubject}.*`);
    expect(a.config.subjects).not.toContain(`${baseSubject}.a`);
    await expect(jsm.streams.info(streamC)).rejects.toThrow();
  });

  test('rethrows add failures that have nothing to do with overlaps', async () => {
    const manager = new StreamManager(nc);
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => {
            throw notFound();
          },
          add: async () => {
            throw new Error('disk I/O error');
          },
        }),
      );
    await expect(
      manager.ensureStream('W10_SM_FAKE5', { subjects: ['w10.sm.fake5.>'] }),
    ).rejects.toThrow('disk I/O error');
  });

  test('resolves overlaps described only via the description field', async () => {
    const manager = new StreamManager(nc);
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => {
            throw notFound();
          },
          add: async () => {
            const err = new Error('request failed') as Error & {
              description?: string;
            };
            err.description = 'subjects overlap with an existing stream';
            throw err;
          },
          list: () => ({ next: async () => [] }),
        }),
      );
    await expect(
      manager.ensureStream('W10_SM_FAKE6', { subjects: ['w10.sm.fake6.>'] }),
    ).rejects.toThrow('request failed');
  });

  test('skips incoming subjects that would collide with sibling streams', async () => {
    const updates: { name: string; subjects: string[] }[] = [];
    const manager = new StreamManager(nc);
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => {
            throw notFound();
          },
          add: async () => {
            throw overlapError();
          },
          list: () => ({
            next: async () => [
              { config: { name: 'W10_SM_P1', subjects: ['w10.smp.one'] } },
              { config: { name: 'W10_SM_P2', subjects: ['w10.smp.two'] } },
            ],
          }),
          update: async (_name: string, config: { name: string; subjects: string[] }) => {
            updates.push({ name: config.name, subjects: config.subjects });
            return {};
          },
        }),
      );

    // 'w10.smp.*' overlaps P1 (selected) but would also capture P2's
    // subject, so the wildcard is skipped and P1 keeps its subjects
    await manager.ensureStream('W10_SM_R', { subjects: ['w10.smp.*'] });
    expect(updates).toEqual([{ name: 'W10_SM_P1', subjects: ['w10.smp.one'] }]);
  });

  test('maps retention policies onto stream configuration', async () => {
    const manager = new StreamManager(nc);
    const workqueue = `W10_SM_W_${suffix}`;
    const interest = `W10_SM_I_${suffix}`;

    await manager.ensureStream(workqueue, {
      subjects: [`w10.smw.${tag}.>`],
      storage: 'memory',
      retention: 'workqueue',
      replicas: 1,
    });
    const w = await jsm.streams.info(workqueue);
    expect(w.config.retention).toBe('workqueue');

    await manager.ensureStream(interest, {
      subjects: [`w10.smi.${tag}.>`],
      storage: 'memory',
      retention: 'interest',
      replicas: 1,
    });
    const i = await jsm.streams.info(interest);
    expect(i.config.retention).toBe('interest');

    // unspecified retention falls back to limits (covered by streamA too)
    await manager.deleteStream(workqueue);
    await manager.deleteStream(interest);
  });

  test('deletes a stream', async () => {
    const name = `W10_SM_E_${suffix}`;
    await createTestStream(jsm, name, [`w10.smd.${tag}.e`]);
    const manager = new StreamManager(nc);
    await manager.deleteStream(name);
    await expect(jsm.streams.info(name)).rejects.toThrow();
  });

  test('rethrows errors that are not "stream not found"', async () => {
    const manager = new StreamManager(nc);
    // invalid stream name fails info() with a different server error
    await expect(
      manager.ensureStream('W10 invalid name!', { subjects: ['w10.sm.invalid.>'] }),
    ).rejects.toThrow();
  });

  test('rethrows when the update of an existing stream fails', async () => {
    const manager = new StreamManager(nc);
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => ({}),
          update: async () => {
            throw new Error('update exploded');
          },
        }),
      );
    await expect(
      manager.ensureStream('W10_SM_FAKE', { subjects: ['w10.sm.fake.>'] }),
    ).rejects.toThrow('update exploded');
  });

  test('rethrows when an overlap has no matching stream left to merge into', async () => {
    const manager = new StreamManager(nc);
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => {
            throw notFound();
          },
          add: async () => {
            throw overlapError();
          },
          list: () => ({ next: async () => [] }),
        }),
      );
    await expect(
      manager.ensureStream('W10_SM_FAKE2', { subjects: ['w10.sm.fake2.>'] }),
    ).rejects.toThrow('subjects overlap');
  });

  test('rethrows the original overlap error when merging into the overlapping stream fails', async () => {
    const manager = new StreamManager(nc);
    // P1 carries no subjects list (covers the defensive `?? []` paths) and
    // P2 is the overlapping stream whose update fails
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => {
            throw notFound();
          },
          add: async () => {
            throw overlapError();
          },
          list: () => ({
            next: async () => [
              { config: { name: 'W10_SM_P0' } },
              { config: { name: 'W10_SM_P2', subjects: ['w10.sm.fake3.>'] } },
            ],
          }),
          update: async () => {
            throw new Error('merge update failed');
          },
        }),
      );
    // the update failure is logged and swallowed; the original overlap
    // error is what propagates to the caller
    await expect(
      manager.ensureStream('W10_SM_FAKE3', { subjects: ['w10.sm.fake3.a'] }),
    ).rejects.toThrow('subjects overlap');
  });

  test('matches a bare ">" overlapping subject during resolution', async () => {
    const manager = new StreamManager(nc);
    const overlapping = {
      config: {
        name: 'W10_SM_GT',
        subjects: ['>'],
      },
    };
    (manager as unknown as { jsm: Promise<JetStreamManager> }).jsm =
      Promise.resolve(
        fakeManager({
          info: async () => {
            throw notFound();
          },
          add: async () => {
            throw overlapError();
          },
          list: () => ({ next: async () => [overlapping] }),
          update: async () => {
            throw new Error('merge update failed');
          },
        }),
      );
    await expect(
      manager.ensureStream('W10_SM_FAKE4', { subjects: ['w10.sm.fake4.a'] }),
    ).rejects.toThrow('subjects overlap');
  });
});
