import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ainrider:password@pgbouncer:5432/ainrider';

export const pgPool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pgPool.on('error', (err) => {
  console.error(JSON.stringify({
    level: 'error',
    service: 'location-service',
    message: 'Postgres pool error',
    error: err.message,
    timestamp: new Date().toISOString(),
  }));
});
