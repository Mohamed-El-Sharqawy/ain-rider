#!/usr/bin/env node
/**
 * One-time migration script: copies existing ADMIN/SUPPORT users from
 * ainrider_auth → ainrider_admin shadow_users table.
 *
 * Run once after splitting databases:
 *   node scripts/seed-shadow-users.mjs
 */

import pg from 'pg';
const { Client } = pg;

const authDb = new Client({
  connectionString: 'postgresql://ainrider:password@localhost:5433/ainrider_auth',
});
const adminDb = new Client({
  connectionString: 'postgresql://ainrider:password@localhost:5433/ainrider_admin',
});

await authDb.connect();
await adminDb.connect();

console.log('🔍 Fetching ADMIN/SUPPORT users from ainrider_auth...');
const { rows } = await authDb.query(
  `SELECT id, email, "phoneNumber", "firstName", "lastName", role, status, "profileImage", "createdAt", "updatedAt"
   FROM users
   WHERE role IN ('ADMIN', 'SUPPORT')`,
);

console.log(`Found ${rows.length} admin/support user(s).`);

for (const user of rows) {
  await adminDb.query(
    `INSERT INTO shadow_users
       (id, email, "phoneNumber", "firstName", "lastName", role, status, "profileImage", "syncedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       "phoneNumber" = EXCLUDED."phoneNumber",
       "firstName" = EXCLUDED."firstName",
       "lastName" = EXCLUDED."lastName",
       role = EXCLUDED.role,
       status = EXCLUDED.status,
       "profileImage" = EXCLUDED."profileImage",
       "updatedAt" = EXCLUDED."updatedAt",
       "syncedAt" = NOW()`,
    [
      user.id, user.email, user.phoneNumber,
      user.firstName, user.lastName,
      user.role, user.status, user.profileImage,
      user.createdAt, user.updatedAt,
    ],
  );
  console.log(`  ✅ Seeded ${user.role}: ${user.email}`);
}

await authDb.end();
await adminDb.end();

console.log('\n✅ Shadow users seeded successfully.');
console.log('Going forward, new users are synced via NATS USER_CREATED events.');
