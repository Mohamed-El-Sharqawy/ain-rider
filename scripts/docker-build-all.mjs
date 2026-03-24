#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('🐳 Building all Docker images...\n');

try {
  console.log('📦 Building Elysia services...');
  execSync('node scripts/docker-build-elysia.mjs', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('\n📦 Building NestJS services...');
  execSync('node scripts/docker-build-nest.mjs', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('\n✅ All Docker images built successfully!');
} catch (error) {
  console.error('❌ Docker build failed');
  process.exit(1);
}
