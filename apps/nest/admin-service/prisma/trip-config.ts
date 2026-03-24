// ─── Trip Prisma Config ──────────────────────────────────────────────────────
// Read-only connection to trip-service's database.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.TRIP_DATABASE_URL,
  },
  schema: "./trip-schema.prisma",
});
