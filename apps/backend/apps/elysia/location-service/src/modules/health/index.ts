import { Elysia } from 'elysia';
import { redisCluster } from '../../shared/redis';
import { pgPool } from '../../shared/db';

export const health = new Elysia()
  .get('/health', () => ({ status: 'ok', service: 'location-service' }))
  .get('/ready', async () => {
    try {
      await redisCluster.ping();
      await pgPool.query('SELECT 1');
      return { status: 'ready', redis: 'ok', postgres: 'ok' };
    } catch (error) {
      return new Response(
        JSON.stringify({ status: 'not ready', error: String(error) }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
