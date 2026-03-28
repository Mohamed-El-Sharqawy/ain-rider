import { execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
};

const rmDir = (p) => {
  const full = join(root, p);
  if (existsSync(full)) {
    console.log(`  removing ${p}`);
    rmSync(full, { recursive: true, force: true });
  }
};

// 1. Clean all package dists
const packages = [
  'error-handling',
  'shared-types',
  'nats-client',
  'redis-client',
  'minio-client',
];

for (const pkg of packages) {
  run(`pnpm --filter @ain-rider/${pkg} clean`);
}

// 2. Clean all NestJS apps (dist and prisma generated)
const nestApps = [
  'auth-service',
  'trip-service',
  'payment-service',
  'admin-service',
];

for (const app of nestApps) {
  rmDir(`apps/nest/${app}/dist`);
  rmDir(`apps/nest/${app}/src/generated`);
}

// 3. Clean all Elysia apps
const elysiaApps = [
  'api-gateway',
  'location-service',
  'match-service',
  'websocket-server',
];

for (const app of elysiaApps) {
  run(`pnpm --filter @ain-rider/${app} clean`);
}

console.log('\n✅ Clean complete.');
console.log('   Run "pnpm install" to reinstall dependencies.');
