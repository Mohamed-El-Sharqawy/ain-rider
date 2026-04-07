#!/usr/bin/env node
import { execSync } from 'child_process';

const packages = [
  '@ain-rider/error-handling',
  '@ain-rider/shared-types',
  '@ain-rider/nats-client',
  '@ain-rider/redis-client',
  '@ain-rider/minio-client',
  '@ain-rider/metrics',
  '@ain-rider/internal-api',
];

console.log('🔄 Building shared packages...\n');

for (const pkg of packages) {
  try {
    console.log(`📦 Building ${pkg}...`);
    execSync(`pnpm --filter ${pkg} build`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log(`✅ ${pkg} built successfully\n`);
  } catch (error) {
    console.error(`❌ ${pkg} - Build failed`);
    process.exit(1);
  }
}

console.log('✅ All packages built successfully!');
