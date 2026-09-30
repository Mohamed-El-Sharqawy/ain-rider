import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { health } from './modules/health';
import { location } from './modules/location';
import { initNats } from './shared/nats';
import { log } from './shared/logger';
import { traceMiddleware } from './shared/trace';
import { errorHandler } from './shared/error-handler';
import { metricsPlugin } from '@ain-rider/metrics';
import { pgPool } from './shared/db';

const PORT = parseInt(process.env.LOCATION_SERVICE_PORT || '3002');
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[LocationService] FATAL: DATABASE_URL environment variable is required');
}

initNats().catch((err) => {
  log('error', 'Failed to connect to NATS', { error: String(err) });
  process.exit(1);
});

// Ensure database schema exists
async function ensureSchema() {
  try {
    // Create Driver Locations table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS driver_locations (
        id          BIGSERIAL,
        driver_id   VARCHAR(255)      NOT NULL,
        latitude    DOUBLE PRECISION  NOT NULL,
        longitude   DOUBLE PRECISION  NOT NULL,
        h3_index    VARCHAR(20)       NOT NULL,
        heading     DOUBLE PRECISION,
        speed       DOUBLE PRECISION,
        recorded_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, recorded_at)
      );
    `);

    // Enable TimescaleDB hypertable
    try {
      await pgPool.query(`SELECT create_hypertable('driver_locations', 'recorded_at', if_not_exists => TRUE);`);
    } catch (e) {
      log('warn', 'Failed to create hypertable (TimescaleDB might not be installed)', { error: String(e) });
    }

    // Indices
    await pgPool.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_locations_h3_recorded_at
      ON driver_locations (h3_index, recorded_at DESC)
    `);

    log('info', 'Database schema for Location Service ensured');
  } catch (err) {
    log('error', 'Failed to ensure database schema', { error: String(err) });
  }
}

ensureSchema();

new Elysia()
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
    })
  )
  .use(
    swagger({
      documentation: {
        info: { title: 'Location Service API', version: '1.0.0' },
      },
    })
  )
  .use(health)
  .use(metricsPlugin({ serviceName: 'location-service' }))
  .use(location)
  .listen(PORT);

log('info', 'Location Service running', { port: PORT });
