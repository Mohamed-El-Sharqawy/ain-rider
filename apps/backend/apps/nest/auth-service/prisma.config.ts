import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DIRECT_URL bypasses PgBouncer for Prisma CLI tools (push, migrate, seed).
// DATABASE_URL (PgBouncer) is used only by the running NestJS application.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgresql://localhost:5433/ainrider_auth',
  },
});
