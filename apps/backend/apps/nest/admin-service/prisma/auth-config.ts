// ─── Auth Prisma Config ──────────────────────────────────────────────────────
// connection to auth-service's database.

import { defineConfig } from 'prisma/config';
import "dotenv/config";

export default defineConfig({
  schema: './auth-schema.prisma',
  datasource: {
    url: process.env.AUTH_DATABASE_URL,
  },
});
