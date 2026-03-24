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
import { AppError, normalizeError, logError, createLogger, ValidationError, NotFoundError, generateTraceId, extractTraceId } from '@ain-rider/error-handling';

const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];
const logger = createLogger({ serviceName: 'api-gateway' });

new Elysia()
  .use(cookie())
  .state('traceId', 'unknown')
  .onRequest(({ request, store }) => {
    const headers = request.headers as unknown as Record<string, string>;
    const traceId = extractTraceId(headers) || generateTraceId();
    store.traceId = traceId;
  })
  .onError(({ code, error, set, store }) => {
    const traceId = (store as any).traceId || 'unknown';
    
    let appError: AppError;
    const errorCode = code as string;
    
    // Handle 404 NOT_FOUND
    if (errorCode === 'NOT_FOUND') {
      appError = new NotFoundError('Resource');
    }
    // Handle Elysia validation errors (code is 'VALIDATION')
    else if (errorCode === 'VALIDATION') {
      const validationError = error as any;
      appError = new ValidationError(
        validationError.summary || 'Validation failed',
        { 
          errors: validationError.errors,
          type: validationError.type 
        }
      );
    }
    else {
      appError = normalizeError(error);
    }
    
    logError(logger, appError, { traceId });
    
    set.status = appError.httpStatus;
    return appError.toResponse(traceId);
  })
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
