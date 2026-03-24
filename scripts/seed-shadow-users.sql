-- Copies existing ADMIN/SUPPORT users from ainrider_auth → ainrider_admin shadow_users.
-- Run via: docker exec -i ain-rider-postgres psql -U ainrider -f /tmp/seed-shadow-users.sql

\connect ainrider_admin

INSERT INTO shadow_users (id, email, "phoneNumber", "firstName", "lastName", role, status, "profileImage", "syncedAt", "createdAt", "updatedAt")
SELECT
  u.id,
  u.email,
  u."phoneNumber",
  u."firstName",
  u."lastName",
  u.role,
  u.status,
  u."profileImage",
  NOW(),
  u."createdAt",
  u."updatedAt"
FROM dblink(
  'host=localhost port=5432 dbname=ainrider_auth user=ainrider password=password',
  'SELECT id, email, "phoneNumber", "firstName", "lastName", role, status, "profileImage", "createdAt", "updatedAt" FROM users WHERE role IN (''ADMIN'',''SUPPORT'')'
) AS u(
  id TEXT,
  email TEXT,
  "phoneNumber" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  role TEXT,
  status TEXT,
  "profileImage" TEXT,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  "phoneNumber" = EXCLUDED."phoneNumber",
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  "profileImage" = EXCLUDED."profileImage",
  "updatedAt" = EXCLUDED."updatedAt",
  "syncedAt" = NOW();

SELECT 'Seeded ' || COUNT(*) || ' shadow user(s)' AS result FROM shadow_users;
