/**
 * matchDriver error path: invalid pickup coordinates make h3 throw inside
 * the try block; the loop must record the error metric and rethrow.
 */
import './helpers/env';
import { beforeAll, expect, test } from 'vitest';
import { MatchService } from '../src/modules/match/service';
import { ensureServiceNats } from './helpers/nats';
import { matchAttemptsTotal } from '../src/shared/metrics';

beforeAll(async () => {
  await ensureServiceNats();
}, 30000);

async function attemptsByResult(result: string): Promise<number> {
  const values = ((await matchAttemptsTotal.get()) as any).values ?? [];
  return values
    .filter((v: any) => (v.labels?.result ?? v.labelPairs?.result) === result)
    .reduce((s: number, v: any) => s + v.value, 0);
}

test('matchDriver rethrows after recording the error metric', async () => {
  const errorsBefore = await attemptsByResult('error');

  await expect(
    MatchService.matchDriver({
      tripId: 'flow-error-1',
      riderId: 'rider-error-1',
      pickupLocation: { latitude: Number.NaN, longitude: Number.NaN },
    }),
  ).rejects.toThrow(/Latitude or longitude/);

  expect(await attemptsByResult('error')).toBe(errorsBefore + 1);
});
