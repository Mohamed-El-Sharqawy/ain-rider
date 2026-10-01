#!/usr/bin/env node
/**
 * Repo-wide lint gate (same ratchet pattern as scripts/typecheck.mjs).
 *
 * Discovers every workspace with a `lint` script, runs it for the ENFORCED
 * list, and fails when an enforced workspace fails. Workspaces with
 * pre-existing lint errors stay in PENDING until fixed, then move up; CI
 * never regresses below the enforced set. A workspace that defines `lint`
 * but is in neither list is reported as UNTRACKED so it cannot slip in
 * unnoticed.
 *
 * The ENFORCED list starts empty: the only workspace with a lint script
 * today (dashboard) fails on pre-existing errors on main (issue #17):
 * - @typescript-eslint/no-explicit-any (DataTable.tsx)
 * - react-hooks/set-state-in-effect (SearchInput.tsx)
 * - react-refresh/only-export-components (shadcn ui components: badge,
 *   button, direction, ...)
 * Once those are paid down (dashboard test/quality tickets), move
 * apps/dashboard into ENFORCED.
 */

import { spawnSync } from "child_process";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const repoRoot = path.resolve(import.meta.dirname, "..");

const ENFORCED = [];
const PENDING = ["apps/dashboard"];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "generated",
]);

/** Every workspace dir (relative to repo root) whose package.json defines a lint script. */
function discoverLintWorkspaces() {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const manifest = path.join(full, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(manifest, "utf8"));
        if (pkg.scripts?.lint) {
          found.push(path.relative(repoRoot, full).split(path.sep).join("/"));
          continue;
        }
      } catch {
        // not a workspace package.json; keep walking
      }
      walk(full);
    }
  };
  walk(path.join(repoRoot, "apps"));
  return found.sort();
}

function fail(message) {
  console.error(`lint: ${message}`);
  process.exit(1);
}

const discovered = discoverLintWorkspaces();
const untracked = discovered.filter(
  (ws) => !ENFORCED.includes(ws) && !PENDING.includes(ws),
);
if (untracked.length > 0) {
  console.warn(
    `lint: UNTRACKED workspaces with a lint script (add to ENFORCED or PENDING): ${untracked.join(", ")}`,
  );
}

const results = [];
for (const workspace of ENFORCED) {
  const dir = path.join(repoRoot, workspace);
  if (!discovered.includes(workspace)) {
    fail(
      `${workspace} is enforced but has no lint script anymore; move it out of ENFORCED.`,
    );
  }
  const run = spawnSync("pnpm run lint", {
    cwd: dir,
    encoding: "utf8",
    shell: true,
  });
  results.push({
    workspace,
    ok: run.status === 0,
    output: `${run.stdout ?? ""}${run.stderr ?? ""}`.trim(),
  });
}

let failures = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`lint: PASS  ${result.workspace}`);
  } else {
    failures += 1;
    console.error(`lint: FAIL  ${result.workspace}`);
    if (result.output) console.error(result.output);
  }
}

console.log(
  `lint: ${results.length - failures}/${results.length} enforced workspaces pass; ` +
    `${PENDING.length} pending (pre-existing errors, see scripts/lint.mjs)`,
);
if (failures > 0) process.exit(1);
