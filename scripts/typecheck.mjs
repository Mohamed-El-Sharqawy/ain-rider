#!/usr/bin/env node
/**
 * Repo-wide typecheck.
 *
 * Runs `tsc --noEmit` in every enforced workspace (solution-style configs —
 * `files: []` + `references` — are typechecked with `tsc -b`, which emits
 * nothing because their leaf projects set `noEmit`). The script fails when
 * any enforced workspace has a type error.
 *
 * The enforced list is a ratchet: workspaces with pre-existing type errors
 * on main stay in PENDING until fixed, then move up. CI enforces exactly
 * this list, so the gate never regresses and tightens as errors are paid
 * down. Known PENDING failures as of the ticket that introduced this script
 * (issue #17):
 * - apps/mobile was ratcheted up to ENFORCED after @types segregation
 *   (backend tsconfig.base pins "types": ["node"] so hoisted @types/*
 *   cannot leak in; mobile tsconfig adds "jest" to types). Its remaining
 *   errors were fixed: unused imports and GoogleMapProvider stub
 *   signatures that did not match MapProvider.
 * - apps/backend/apps/elysia/api-gateway: unused `set` (TS6133) +
 *   proxy-error `unknown` assignment (TS2322).
 * - apps/backend/packages/metrics (src/elysia/plugin.ts unused `_request`,
 *   TS6133) poisons every service workspace that typechecks against
 *   metrics sources via tsconfig.base paths: api-gateway, location-service,
 *   match-service, websocket-server, admin-service, auth-service,
 *   payment-service, trip-service.
 * - apps/backend/packages/nats-client: cannot resolve @ain-rider/shared-types.
 * - apps/backend/packages/test-utils: cannot resolve @ain-rider/nats-client
 *   and @ain-rider/redis-client.
 */

import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "..");
const tscBin = require.resolve("typescript/bin/tsc");

const ENFORCED = [
  "apps/dashboard",
  "apps/mobile",
  "apps/backend/packages/config",
  "apps/backend/packages/error-handling",
  "apps/backend/packages/internal-api",
  "apps/backend/packages/metrics",
  "apps/backend/packages/minio-client",
  "apps/backend/packages/redis-client",
  "apps/backend/packages/shared-types",
];

const PENDING = [
  "apps/backend/apps/elysia/api-gateway",
  "apps/backend/apps/elysia/location-service",
  "apps/backend/apps/elysia/match-service",
  "apps/backend/apps/elysia/websocket-server",
  "apps/backend/apps/nest/admin-service",
  "apps/backend/apps/nest/auth-service",
  "apps/backend/apps/nest/payment-service",
  "apps/backend/apps/nest/trip-service",
  "apps/backend/packages/nats-client",
  "apps/backend/packages/test-utils",
];

function fail(message) {
  console.error(`typecheck: ${message}`);
  process.exit(1);
}

const results = [];
for (const workspace of ENFORCED) {
  const dir = path.join(repoRoot, workspace);
  const configPath = path.join(dir, "tsconfig.json");
  let raw;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    fail(`no readable tsconfig.json in ${workspace}`);
  }
  // tsconfig files are JSONC (comments, trailing commas), so detect
  // solution-style configs by pattern instead of JSON.parse.
  const solutionStyle =
    /"references"\s*:/.test(raw) && /"files"\s*:\s*\[\s*\]/.test(raw);
  const args = solutionStyle ? ["-b", dir] : ["--noEmit", "-p", dir];

  const run = spawnSync(process.execPath, [tscBin, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    results.push({
      workspace,
      ok: false,
      output: `${run.stdout ?? ""}${run.stderr ?? ""}`.trim(),
    });
  } else {
    results.push({ workspace, ok: true, output: "" });
  }
}

let failures = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`typecheck: PASS  ${result.workspace}`);
  } else {
    failures += 1;
    console.error(`typecheck: FAIL  ${result.workspace}`);
    if (result.output) console.error(result.output);
  }
}

console.log(
  `typecheck: ${results.length - failures}/${results.length} enforced workspaces pass; ` +
    `${PENDING.length} pending (pre-existing errors, see scripts/typecheck.mjs)`,
);
if (failures > 0) process.exit(1);
