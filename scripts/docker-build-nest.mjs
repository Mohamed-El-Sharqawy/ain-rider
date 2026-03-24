#!/usr/bin/env node
import { execSync } from 'child_process';

const services = [
  { name: 'auth-service', tag: 'ainrider/auth-service:local' },
  { name: 'trip-service', tag: 'ainrider/trip-service:local' },
  { name: 'payment-service', tag: 'ainrider/payment-service:local' },
  { name: 'admin-service', tag: 'ainrider/admin-service:local' },
];

console.log('🐳 Building Docker images for NestJS services...\n');

for (const service of services) {
  try {
    console.log(`📦 Building ${service.name}...`);
    execSync(
      `docker build -f apps/nest/${service.name}/Dockerfile -t ${service.tag} .`,
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

console.log('✅ All NestJS Docker images built successfully!');
