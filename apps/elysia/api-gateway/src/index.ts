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

const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

new Elysia()
  .use(cookie())
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
  .onError(({ code, error, set }) => {
    let message = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String((error as Record<string, unknown>).message);
    }

    if (typeof code === 'number') {
      statusCode = code;
    } else {
      switch (code) {
        case 'VALIDATION':
          statusCode = 400;
          message = message === 'Internal server error' ? 'Validation failed' : message;
          break;
        case 'INTERNAL_SERVER_ERROR':
          statusCode = 500;
          break;
        case 'INVALID_FILE_TYPE':
          statusCode = 400;
          message = 'Invalid file type';
          break;
        case 'UNKNOWN':
          statusCode = 500;
          break;
      }
    }

    set.status = statusCode as any;
    log('error', 'Request error', { code, message, statusCode });

    return {
      success: false,
      error: { code: statusCode, message },
      timestamp: new Date().toISOString(),
    };
  })
  .use(health)
  .use(metrics)
  .use(auth)
  .use(trips)
  .use(admin)
  .listen(PORT);

log('info', `API Gateway running`, { port: PORT });
log('info', `Swagger docs available`, { url: `http://localhost:${PORT}/swagger` });
