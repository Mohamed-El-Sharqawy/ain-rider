#!/usr/bin/env node
/**
 * Push Prisma schemas to each service's dedicated database.
 *
 * Uses DIRECT_URL (port 5433, bypasses PgBouncer) because Prisma migrations
 * require a persistent session-mode connection, not a transaction-mode pool.
 *
 * Usage:
 *   node scripts/prisma-push.mjs          # push all services
 *   node scripts/prisma-push.mjs auth     # push only auth-service
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BASE = 'postgresql://ainrider:password@localhost:5433';

const services = [
  {
    name: '@ain-rider/auth-service',
    dir: 'apps/nest/auth-service',
    db: `${BASE}/ainrider_auth`,
  },
  {
    name: '@ain-rider/admin-service',
    dir: 'apps/nest/admin-service',
    db: `${BASE}/ainrider_admin`,
  },
  {
    name: '@ain-rider/trip-service',
    dir: 'apps/nest/trip-service',
    db: `${BASE}/ainrider_trip`,
  },
  {
    name: '@ain-rider/payment-service',
    dir: 'apps/nest/payment-service',
    db: `${BASE}/ainrider_payment`,
  },
];

const filter = process.argv[2];
const targets = filter
  ? services.filter((s) => s.name.includes(filter) || s.dir.includes(filter))
  : services;

if (targets.length === 0) {
  console.error(`No service matched filter: "${filter}"`);
  process.exit(1);
}

console.log('🔄 Pushing Prisma schemas (direct connection, bypasses PgBouncer)...\n');

let hasError = false;

for (const svc of targets) {
  console.log(`📤 Pushing schema for ${svc.name}...`);
  try {
    execSync('npx prisma db push --accept-data-loss', {
      cwd: path.join(root, svc.dir),
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: svc.db },
    });
    console.log(`✅ ${svc.name} — done\n`);
  } catch {
    console.error(`❌ ${svc.name} — failed\n`);
    hasError = true;
  }
}

if (hasError) process.exit(1);
console.log('✅ All schemas pushed successfully.');
