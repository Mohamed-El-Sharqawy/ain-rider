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

// Clean all package dists
run('pnpm --filter @ain-rider/shared-types clean');
run('pnpm --filter @ain-rider/nats-client clean');
run('pnpm --filter @ain-rider/redis-client clean');

// Clean all NestJS app dists and generated prisma clients
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

console.log('\n✅ Clean complete.');
console.log('   Run "pnpm install" to reinstall dependencies.');
