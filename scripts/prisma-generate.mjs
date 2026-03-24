#!/usr/bin/env node
/**
 * Generate Prisma clients for all services.
 *
 * Usage:
 *   node scripts/prisma-generate.mjs          # all services
 *   node scripts/prisma-generate.mjs admin     # only admin-service
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const services = [
  { name: '@ain-rider/auth-service',    dir: 'apps/nest/auth-service' },
  { name: '@ain-rider/admin-service',   dir: 'apps/nest/admin-service' },
  { name: '@ain-rider/trip-service',    dir: 'apps/nest/trip-service' },
  { name: '@ain-rider/payment-service', dir: 'apps/nest/payment-service' },
];

const filter = process.argv[2];
const targets = filter
  ? services.filter((s) => s.name.includes(filter) || s.dir.includes(filter))
  : services;

if (targets.length === 0) {
  console.error(`No service matched filter: "${filter}"`);
  process.exit(1);
}

console.log('🔄 Generating Prisma clients...\n');

let hasError = false;

for (const svc of targets) {
  console.log(`⚙️  Generating for ${svc.name}...`);
  try {
    execSync('npx prisma generate', {
      cwd: path.join(root, svc.dir),
      stdio: 'inherit',
    });
    console.log(`✅ ${svc.name} — done\n`);
  } catch {
    console.error(`❌ ${svc.name} — failed\n`);
    hasError = true;
  }
}

if (hasError) process.exit(1);
console.log('✅ All Prisma clients generated.');
