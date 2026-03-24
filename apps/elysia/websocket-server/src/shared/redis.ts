import { createRedisCluster } from '@ain-rider/redis-client';

const REDIS_NODES = (process.env.REDIS_NODES || 'localhost:6379').split(',');

export const redisCluster = createRedisCluster({
  nodes: REDIS_NODES,
  keyPrefix: 'ws-server:',
});
