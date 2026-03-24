#!/usr/bin/env node
// ─── Sync Trip Schema ────────────────────────────────────────────────────────
// Copies the Trip model from trip-service to admin-service's read-only schema.
// Run this whenever trip-service updates its Trip model.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const tripServiceSchema = join(rootDir, 'apps/nest/trip-service/prisma/schema.prisma');
const adminServiceTripSchema = join(rootDir, 'apps/nest/admin-service/prisma/trip-schema.prisma');

console.log('📋 Syncing Trip schema from trip-service to admin-service...\n');

try {
  const sourceContent = readFileSync(tripServiceSchema, 'utf-8');
  
  const tripModelMatch = sourceContent.match(/model Trip \{[\s\S]*?\n\}/);
  
  if (!tripModelMatch) {
    throw new Error('Could not find Trip model in trip-service schema');
  }
  
  const tripModel = tripModelMatch[0];
  
  const targetContent = `// ─── Trip Schema (Read-Only) ─────────────────────────────────────────────────
// This schema is ONLY for reading from trip-service's database.
// Admin-service NEVER runs migrations on this database.
// Trip-service owns the schema and all migrations.
// This is a COPY of trip-service's schema for read-only access.
//
// 🔄 Auto-synced from: apps/nest/trip-service/prisma/schema.prisma
// 📅 Last synced: ${new Date().toISOString()}

generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/trip-prisma"
}

datasource db {
  provider = "postgresql"
}

${tripModel}
`;

  writeFileSync(adminServiceTripSchema, targetContent, 'utf-8');
  
  console.log('✅ Trip model synced successfully!');
  console.log(`📁 Source: ${tripServiceSchema}`);
  console.log(`📁 Target: ${adminServiceTripSchema}`);
  console.log('\n🔧 Next steps:');
  console.log('   cd apps/nest/admin-service');
  console.log('   npx prisma generate --schema=prisma/trip-schema.prisma');
  
} catch (error) {
  console.error('❌ Failed to sync Trip schema:', error.message);
  process.exit(1);
}
