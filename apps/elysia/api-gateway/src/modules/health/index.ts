import { Elysia } from 'elysia';
import { redisCluster } from '../../shared/redis';

export const health = new Elysia()
  .get('/health', () => ({ status: 'ok', service: 'api-gateway' }))
  .get('/ready', async () => {
    try {
      await redisCluster.ping();
      return { status: 'ready', redis: 'ok' };
    } catch {
      return new Response(
        JSON.stringify({ status: 'not ready', redis: 'disconnected' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
