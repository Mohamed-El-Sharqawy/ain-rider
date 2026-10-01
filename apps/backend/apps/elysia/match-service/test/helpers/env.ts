/**
 * Test environment defaults for match-service.
 *
 * Import this file FIRST in every test file (before any ../src import) so
 * module-level env reads in the service see the test values.
 */
import { loadTestEnv } from '@ain-rider/test-utils';

process.env.NODE_ENV ||= 'test';
process.env.INTERNAL_SERVICE_SECRET ||= 'test-internal-secret';

// Service timing knobs (read at module load by src/modules/match/service.ts)
process.env.MAX_SEARCH_TIME_S ||= '4';
process.env.DRIVER_RESPONSE_TIMEOUT_S ||= '2';
process.env.DRIVER_RESPONSE_POLL_MS ||= '50';
process.env.SEARCH_RINGS ||= '1,2,4,8';
process.env.MAX_SEARCH_RADIUS_M ||= '2000';

// NATS retry knobs (read at module load by fresh-eval imports in nats retry tests)
process.env.NATS_MAX_RETRIES ||= '5';
process.env.NATS_RETRY_DELAY_MS ||= '100';

// External HTTP dependencies default to a dead local port so fetches fail
// fast; individual tests override with their own node http mocks.
process.env.AUTH_SERVICE_URL ||= 'http://127.0.0.1:1';
process.env.OSRM_URL ||= 'http://127.0.0.1:1';

loadTestEnv();

// Seed the cluster with all six nodes (the harness contract from
// @ain-rider/test-utils): REDIS_NAT_MAP translates the hostnames the
// cluster announces, and connecting to every node up front keeps the
// slots map complete, which avoids MOVED-redirection loops between
// sequentially-run test files. The old three-node seed was a workaround
// for a bun-on-Windows connect stall; tests run on node now.
process.env.REDIS_NODES =
  'localhost:6379,localhost:6380,localhost:6381,localhost:6382,localhost:6383,localhost:6384';

// Warm the shared redis cluster once per run, before any test executes:
// the first command after a cold connect races the slot handshake and can
// fail with cluster redirection errors.
const deadline = Date.now() + 20000;
for (;;) {
  try {
    const { redisCluster } = await import('../../src/shared/redis');
    await redisCluster.ping();
    break;
  } catch (error) {
    if (Date.now() > deadline) {
      throw new Error(`redis cluster not ready for match-service tests: ${String(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
