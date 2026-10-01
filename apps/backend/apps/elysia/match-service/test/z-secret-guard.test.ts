/**
 * internal-auth.ts fails fast at module load when INTERNAL_SERVICE_SECRET is
 * missing. The guard line is exercised through a fresh module evaluation
 * (?query import) with the secret deleted; the thrown error is caught here.
 */
import './helpers/env';
import { afterAll, expect, test } from 'vitest';

test('module load without INTERNAL_SERVICE_SECRET throws immediately', async () => {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  delete process.env.INTERNAL_SERVICE_SECRET;
  try {
    await import('../src/shared/internal-auth.ts?secret-guard');
    throw new Error('expected module load to fail');
  } catch (error) {
    expect(String(error)).toContain('INTERNAL_SERVICE_SECRET');
  } finally {
    process.env.INTERNAL_SERVICE_SECRET = secret!;
  }
});

afterAll(() => {
  process.env.INTERNAL_SERVICE_SECRET ||= 'test-internal-secret';
});
