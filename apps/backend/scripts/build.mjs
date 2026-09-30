import { execSync } from 'node:child_process';

const run = (cmd, cwd) => {
  console.log(`\n> ${cmd}${cwd ? ` (cwd: ${cwd})` : ''}`);
  execSync(cmd, { stdio: 'inherit', cwd });
};

// 1. Build packages in dependency order
const packages = [
  'error-handling',
  'shared-types',
  'nats-client',
  'redis-client',
  'minio-client',
  'metrics',
  'internal-api',
];

for (const pkg of packages) {
  run(`pnpm --filter @ain-rider/${pkg} build`);
}

// 2. Build all NestJS apps
const nestApps = [
  'auth-service',
  'trip-service',
  'payment-service',
  'admin-service',
];

for (const app of nestApps) {
  run(`pnpm --filter @ain-rider/${app} build`);
}

// 3. Build all Elysia apps
const elysiaApps = [
  'api-gateway',
  'location-service',
  'match-service',
  'websocket-server',
];

for (const app of elysiaApps) {
  run(`pnpm --filter @ain-rider/${app} build`);
}

console.log('\n✅ All packages and apps built successfully.');
