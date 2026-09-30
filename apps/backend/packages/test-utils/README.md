# @ain-rider/test-utils

Integration test harness for the ain-rider backend. Gives every service
suite: dedicated test databases, clients for the docker infra, and test env
defaults.

## Prerequisites

1. Docker running.
2. Infra up: `pnpm docker:infra:up` from the repo root (postgres on 5433,
   redis cluster on 6379-6384, nats on 4222-4224, minio on 9000).

## What it provides

| Export | What it does |
| --- | --- |
| `loadTestEnv()` | Applies docker-compose env defaults (existing env wins). |
| `ensureTestDatabase(service)` | Creates `ainrider_<service>_test` if missing, pushes the schema (prisma `db push`, or raw DDL for `location`). Once per process. |
| `resetTestDatabase(service)` | Truncates every user table in the service test db (`RESTART IDENTITY CASCADE`). |
| `getTestDbPool(service)` / `closeTestDbPools()` | Pooled pg connections for the test db. |
| `createTestNatsConnection(name?)` | NATS connection against the test cluster, fast-fail reconnects. |
| `createTestRedis(prefix?)` | Redis cluster client with an isolated `test:` key prefix. |
| `createTestMinio()` / `ensureTestBucket(client)` | MinIO client and the dedicated `ain-rider-test` bucket. |

`service` is one of `auth`, `admin`, `trip`, `payment`, `location`.

## Usage (vitest, nest services and node packages)

```ts
import { ensureTestDatabase, resetTestDatabase } from '@ain-rider/test-utils';

beforeAll(async () => {
  await ensureTestDatabase('trip');
});

beforeEach(async () => {
  await resetTestDatabase('trip');
});
```

## Usage (bun test, elysia services)

```ts
import { beforeAll, beforeEach, test } from 'bun:test';
import { ensureTestDatabase, resetTestDatabase } from '@ain-rider/test-utils';

beforeAll(async () => {
  await ensureTestDatabase('trip');
});

beforeEach(async () => {
  await resetTestDatabase('trip');
});
```

## Notes

- Test databases end in `_test`; dev databases are never touched.
- The prisma schema push uses the direct postgres port (5433), not
  PgBouncer, because prisma needs a session-mode connection (same approach
  as `scripts/prisma-push.mjs`).
- Run this package's smoke test to verify the harness against docker:
  `pnpm --filter @ain-rider/test-utils test`.
