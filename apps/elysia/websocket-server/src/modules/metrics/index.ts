import { Elysia } from 'elysia';
import { register } from '../../shared/metrics';

export const metrics = new Elysia()
  .get('/metrics', async () => {
    return new Response(await register.metrics(), {
      headers: { 'Content-Type': register.contentType },
    });
  });
