#!/usr/bin/env node
import { execSync } from 'child_process';

const services = [
  { name: 'api-gateway', tag: 'ainrider/api-gateway:local' },
  { name: 'websocket-server', tag: 'ainrider/websocket-server:local' },
  { name: 'location-service', tag: 'ainrider/location-service:local' },
  { name: 'match-service', tag: 'ainrider/match-service:local' },
];

console.log('🐳 Building Docker images for Elysia services...\n');

for (const service of services) {
  try {
    console.log(`📦 Building ${service.name}...`);
    execSync(
      `docker build -f apps/elysia/${service.name}/Dockerfile -t ${service.tag} .`,
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );
    console.log(`✅ ${service.name} built successfully\n`);
  } catch (error) {
    console.error(`❌ ${service.name} - Build failed`);
    process.exit(1);
  }
}

console.log('✅ All Elysia Docker images built successfully!');
