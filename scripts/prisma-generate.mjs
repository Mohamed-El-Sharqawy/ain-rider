#!/usr/bin/env node
/**
 * Generate Prisma clients for all services.
 * 
 * Includes multi-schema generation for services like admin-service.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const services = [
  { 
    name: '@ain-rider/auth-service',    
    dir: 'apps/nest/auth-service',
    commands: ['npx prisma generate']
  },
  { 
    name: '@ain-rider/admin-service',   
    dir: 'apps/nest/admin-service',
    commands: [
      'npx prisma generate',
      'npx prisma generate --schema=prisma/trip-schema.prisma',
      'npx prisma generate --schema=prisma/auth-schema.prisma'
    ]
  },
  { 
    name: '@ain-rider/trip-service',    
    dir: 'apps/nest/trip-service',
    commands: ['npx prisma generate']
  },
  { 
    name: '@ain-rider/payment-service', 
    dir: 'apps/nest/payment-service',
    commands: ['npx prisma generate']
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

console.log('🔄 Generating Prisma clients...\n');

let hasError = false;

for (const svc of targets) {
  console.log(`⚙️  Generating for ${svc.name}...`);
  for (const cmd of svc.commands) {
    try {
      execSync(cmd, {
        cwd: path.join(root, svc.dir),
        stdio: 'inherit',
      });
    } catch {
      console.error(`❌ ${svc.name} — failed on command: ${cmd}\n`);
      hasError = true;
    }
  }
  if (!hasError) console.log(`✅ ${svc.name} — done\n`);
}

if (hasError) process.exit(1);
console.log('✅ All Prisma clients generated.');
