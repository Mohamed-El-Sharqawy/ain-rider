import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
const args = process.argv.slice(2);
const forceReset = args.includes('--reset') || args.includes('-f');

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting NATS infrastructure setup...');
console.log(`Target: \x1b[34m${natsUrl}\x1b[0m${forceReset ? ' [\x1b[31mRESET MODE\x1b[0m]' : ''}`);

try {
  if (forceReset) {
    console.log('\n\x1b[31m%s\x1b[0m', 'Step 1: Resetting NATS Streams (Cleaning old configuration)...');
    execSync('npx tsx packages/nats-client/scripts/reset-streams.ts', {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, NATS_URL: natsUrl }
    });
  } else {
    console.log('\n\x1b[33m%s\x1b[0m', 'Step 1: Setting up JetStream Streams...');
    try {
      execSync('npx tsx packages/nats-client/scripts/setup-streams.ts', {
        cwd: rootDir,
        stdio: 'inherit',
        env: { ...process.env, NATS_URL: natsUrl }
      });
    } catch (e) {
      console.log('\n\x1b[33m%s\x1b[0m', '⚠️  Stream setup failed. This often happens because subject \'"ain_rider.>" overlaps with an existing stream\'.');
      console.log('\x1b[33m%s\x1b[0m', 'Run: \x1b[37mpnpm create:nats --reset\x1b[0m to clear old streams and start fresh (destructive).');
      process.exit(1);
    }
  }

  console.log('\n\x1b[33m%s\x1b[0m', 'Step 2: Setting up JetStream Consumers...');
  execSync('npx tsx packages/nats-client/scripts/setup-consumers.ts', {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, NATS_URL: natsUrl }
  });

  console.log('\n\x1b[32m%s\x1b[0m', '✅ NATS setup completed successfully!');
} catch (error) {
  // Errors already printed to stdio: inherit
  process.exit(1);
}
