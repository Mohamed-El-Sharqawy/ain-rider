import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { cookie } from '@elysiajs/cookie';
import { rateLimit } from 'elysia-rate-limit';
import { health } from './modules/health';
import { metrics } from './modules/metrics';
import { auth } from './modules/auth';
import { trips } from './modules/trips';
import { admin } from './modules/admin';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';

const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

new Elysia()
  .use(cookie())
  .use(traceMiddleware)
  .use(errorHandler)
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get('origin');
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return true;
        }
        return false;
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  )
  .use(
    swagger({
      documentation: {
        info: { title: '911 Ain Rider API Gateway', version: '1.0.0' },
        components: {
          securitySchemes: {
            cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
          },
        },
      },
    })
  )
  .use(
    rateLimit({
      duration: 60_000,
      max: 100,
      generator: (req) =>
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous',
    })
  )
  .use(health)
  .use(metrics)
  .use(auth)
  .use(trips)
  .use(admin)
  .listen(PORT);

log('info', `API Gateway running`, { port: PORT });
log('info', `Swagger docs available`, { url: `http://localhost:${PORT}/swagger` });
