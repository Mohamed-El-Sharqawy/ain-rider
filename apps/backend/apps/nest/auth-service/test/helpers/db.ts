import { ensureTestDatabase, resetTestDatabase } from "@ain-rider/test-utils";

/**
 * Point DATABASE_URL at the dedicated ainrider_auth_test database (created
 * and schema-pushed on demand) and clear it between suites.
 */
export async function setupAuthDb(): Promise<void> {
  process.env.DATABASE_URL = await ensureTestDatabase("auth");
}

export async function resetAuthDb(): Promise<void> {
  await resetTestDatabase("auth");
}
