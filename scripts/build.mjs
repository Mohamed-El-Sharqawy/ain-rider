import { execSync } from 'node:child_process';

const run = (cmd, cwd) => {
  console.log(`\n> ${cmd}${cwd ? ` (cwd: ${cwd})` : ''}`);
  execSync(cmd, { stdio: 'inherit', cwd });
};

// 1. Build packages in dependency order
run('pnpm --filter @ain-rider/shared-types build');
run('pnpm --filter @ain-rider/nats-client build');
run('pnpm --filter @ain-rider/redis-client build');

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
  'location-service',
  'match-service',
  'websocket-server',
];

for (const app of elysiaApps) {
  run(`pnpm --filter @ain-rider/${app} build`);
}

console.log('\n✅ All packages and apps built successfully.');
