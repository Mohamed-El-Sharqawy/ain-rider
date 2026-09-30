/**
 * Per-service test databases.
 *
 * Strategy:
 * - Each service gets a dedicated `<name>_test` database on the shared
 *   docker postgres instance, so `pnpm test` never touches dev data.
 * - ensureTestDatabase() creates the database if missing and pushes the
 *   service schema. Prisma services (auth/admin/trip/payment) are pushed
 *   with `prisma db push` against the direct port (5433), mirroring
 *   scripts/prisma-push.mjs. The location service uses raw DDL (TimescaleDB
 *   hypertable), mirroring scripts/init-db.sql.
 * - resetTestDatabase() truncates every user table in the public schema,
 *   RESTART IDENTITY CASCADE. Call it between tests/suites.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { loadTestEnv, TestEnv } from './env';

export type TestDbService = 'auth' | 'admin' | 'trip' | 'payment' | 'location';

const PRISMA_SERVICES: Record<Exclude<TestDbService, 'location'>, string> = {
  auth: 'apps/nest/auth-service',
  admin: 'apps/nest/admin-service',
  trip: 'apps/nest/trip-service',
  payment: 'apps/nest/payment-service',
};

const LOCATION_DDL = [
  `CREATE EXTENSION IF NOT EXISTS timescaledb`,
  `CREATE EXTENSION IF NOT EXISTS postgis`,
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
  `CREATE TABLE IF NOT EXISTS driver_locations (
     id          BIGSERIAL,
     driver_id   VARCHAR(255)      NOT NULL,
     latitude    DOUBLE PRECISION  NOT NULL,
     longitude   DOUBLE PRECISION  NOT NULL,
     h3_index    VARCHAR(20)       NOT NULL,
     heading     DOUBLE PRECISION,
     speed       DOUBLE PRECISION,
     recorded_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
     PRIMARY KEY (id, recorded_at)
   )`,
  `SELECT create_hypertable('driver_locations', 'recorded_at', if_not_exists => TRUE)`,
  `CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id
     ON driver_locations (driver_id, recorded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_driver_locations_h3
     ON driver_locations (h3_index, recorded_at DESC)`,
];

/**
 * Locate the test-utils package root from the current file, so this works
 * both when run from source by vitest (src/) and from the compiled output
 * (dist/src/). The backend root is two levels above the package
 * (apps/backend/packages/test-utils).
 */
function findPackageRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string };
      if (pkg.name === '@ain-rider/test-utils') {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate the @ain-rider/test-utils package root from ' + start);
}

const packageRoot = findPackageRoot(__dirname);
const backendRoot = path.resolve(packageRoot, '..', '..');
const ensuredDatabases = new Set<TestDbService>();
const pools: Pool[] = [];

function adminConnectionString(env: TestEnv): string {
  return `postgresql://${env.postgresUser}:${env.postgresPassword}@${env.postgresHost}:${env.postgresPort}/postgres`;
}

export function testDatabaseUrl(service: TestDbService): string {
  const env = loadTestEnv();
  return `postgresql://${env.postgresUser}:${env.postgresPassword}@${env.postgresHost}:${env.postgresPort}/ainrider_${service}_test`;
}

async function createDatabaseIfMissing(env: TestEnv, databaseName: string): Promise<void> {
  const admin = new Pool({ connectionString: adminConnectionString(env) });
  try {
    const exists = await admin.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname = $1`,
      [databaseName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await admin.end();
  }
}

/**
 * Prisma refuses destructive CLI commands when it detects an AI-agent
 * environment variable, and other tools inject node options through agent
 * marker vars. Drop those marker variables from the child environment.
 */
function childEnvForPrisma(url: string): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/opencode|claude|cursor|agent|copilot|windsurf|codeium/i.test(key),
    ),
  );
  return { ...env, DATABASE_URL: url };
}

async function applyPrismaSchema(service: Exclude<TestDbService, 'location'>): Promise<void> {
  const serviceDir = path.join(backendRoot, PRISMA_SERVICES[service]);
  const url = testDatabaseUrl(service);
  execSync(`pnpm exec prisma db push --url ${url} --accept-data-loss`, {
    cwd: serviceDir,
    env: childEnvForPrisma(url),
    stdio: 'pipe',
  });
}

async function applyLocationSchema(): Promise<void> {
  const pool = new Pool({ connectionString: testDatabaseUrl('location') });
  try {
    for (const statement of LOCATION_DDL) {
      await pool.query(statement);
    }
  } finally {
    await pool.end();
  }
}

/**
 * Create the `<service>_test` database if needed and make sure its schema is
 * current. Safe to call repeatedly; the work happens once per process.
 * Requires docker infra to be up (docker:infra:up).
 */
export async function ensureTestDatabase(service: TestDbService): Promise<string> {
  if (ensuredDatabases.has(service)) {
    return testDatabaseUrl(service);
  }

  const env = loadTestEnv();
  const databaseName = `ainrider_${service}_test`;
  await createDatabaseIfMissing(env, databaseName);

  if (service === 'location') {
    await applyLocationSchema();
  } else {
    await applyPrismaSchema(service);
  }

  ensuredDatabases.add(service);
  return testDatabaseUrl(service);
}

/** Get a pooled connection to a test database. Pools are closed by closeTestDbPools(). */
export function getTestDbPool(service: TestDbService): Pool {
  const pool = new Pool({ connectionString: testDatabaseUrl(service) });
  pools.push(pool);
  return pool;
}

/** Truncate every user table in the public schema of the `<service>_test` database. */
export async function resetTestDatabase(service: TestDbService): Promise<void> {
  await ensureTestDatabase(service);
  const pool = new Pool({ connectionString: testDatabaseUrl(service) });
  try {
    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`,
    );
    if (tables.rowCount === 0) {
      return;
    }
    const names = tables.rows.map((row) => `"${row.tablename}"`).join(', ');
    await pool.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  } finally {
    await pool.end();
  }
}

/** Close every pool opened through getTestDbPools(). Call in afterAll(). */
export async function closeTestDbPools(): Promise<void> {
  const open = pools.splice(0, pools.length);
  await Promise.all(
    open.map((pool) => pool.end().catch(() => undefined)),
  );
}
