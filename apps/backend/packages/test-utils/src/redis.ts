/**
 * Redis test client: wraps @ain-rider/redis-client's cluster factory against
 * the docker redis cluster, with a `test:` key prefix for isolation.
 */

import { Cluster, createRedisCluster } from '@ain-rider/redis-client';
import { loadTestEnv } from './env';

export function createTestRedis(keyPrefix = 'test:'): Cluster {
  const env = loadTestEnv();
  return createRedisCluster({
    nodes: env.redisNodes,
    keyPrefix,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
}
