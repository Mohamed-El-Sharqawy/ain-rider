#!/usr/bin/env node
/**
 * Merged lcov coverage gate for the whole repo.
 *
 * Implements the decision recorded in docs/research/coverage-tooling.md and
 * docs/adr/0001-coverage-gate.md:
 *
 * 1. Discover every workspace `coverage/lcov.info` under apps/ (mobile is
 *    excluded from the merged gate; it reports locally only).
 * 2. Normalize `SF:` paths to repo-relative forward-slashed paths. bun and
 *    vitest both emit workspace-relative paths, so two workspaces can both
 *    carry `src/index.ts`; merging without normalization would fuse their
 *    records and corrupt the gate.
 * 3. Completeness check: every non-excluded TypeScript source file under src/
 *    of a reporting workspace must appear in its coverage. bun only reports
 *    files loaded during the test run, so an entirely untested module would
 *    otherwise be invisible and silently pass a 100% gate.
 * 4. Merge with the lcov CLI (`--add-tracefile`), strip the canonical
 *    excludes (`--remove`), and gate with `--fail-under-lines 100
 *    --fail-under-branches 100`. Branch records exist only for vitest/jest
 *    workspaces; bun files carry none, so the branch bar holds exactly where
 *    the runtime can measure it.
 *
 * While no workspace emits coverage yet the gate passes vacuously: its scope
 * grows automatically as test suites land and start writing lcov.
 *
 * Requires the `lcov` CLI on PATH (CI installs it natively on the Linux
 * runner; deployment targets are Linux).
 */

import { spawnSync } from "child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, "..");

/** Workspaces never part of the merged gate. */
const EXCLUDED_WORKSPACES = ["apps/mobile"];

/** Canonical exclude globs handed to `lcov --remove` (ADR 0001). */
const LCOV_EXCLUDES = [
  "*/generated/*",
  "*/node_modules/*",
  "*/dist/*",
  "*.d.ts",
  "*/src/main.ts",
  "*/src/main.tsx",
  "*/src/index.ts",
  "*.config.*",
  "*/shared-types/*",
  // test files and in-src helpers (dashboard keeps __tests__ under src/)
  "*/__tests__/*",
  "*.test.ts",
  "*.test.tsx",
  "*.spec.ts",
  "*.spec.tsx",
  "*/src/test/*",
  // configs and type-only modules carry no runtime statements to cover
  "*/src/config/*",
  "*/src/types/*",
  // shadcn registry-generated ui primitives (vendor code, not hand-written)
  "*/src/components/ui/*",
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function fail(message) {
  console.error(`coverage-gate: ${message}`);
  process.exit(1);
}

function requireLcov() {
  const probe = spawnSync("lcov", ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (probe.error || probe.status !== 0) {
    fail(
      "lcov CLI not found on PATH. Install it (e.g. `sudo apt-get install -y lcov`).",
    );
  }
}

/** Recursively find every `coverage/lcov.info` under `dir`, skipping junk dirs. */
function findLcovFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
      if (
        entry.name === "coverage" &&
        statSync(path.join(full, "lcov.info"), { throwIfNoEntry: false })
      ) {
        out.push(path.join(full, "lcov.info"));
        continue;
      }
      findLcovFiles(full, out);
    }
  }
  return out;
}

function walkSources(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ["node_modules", "dist", "generated", "coverage"].includes(entry.name)
      )
        continue;
      walkSources(full, out);
    } else if (
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * True when the ADR exclude list drops this repo-relative path from the gate.
 * lcov glob semantics: `*` matches any run of characters, including `/`.
 */
function isExcludedSource(repoRelative) {
  const posix = repoRelative.split(path.sep).join("/");
  return LCOV_EXCLUDES.some((glob) => {
    const pattern = glob
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`(?:^|/)${pattern}$`).test(posix);
  });
}

function toRepoRelative(absolute) {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

// ── 1. discover ──────────────────────────────────────────────────────────────
const allLcov = findLcovFiles(path.join(repoRoot, "apps")).filter(
  (file) =>
    !EXCLUDED_WORKSPACES.some((ws) => toRepoRelative(file).startsWith(ws)),
);

if (allLcov.length === 0) {
  console.log(
    "coverage-gate: no workspace emits coverage/lcov.info yet; gate passes vacuously " +
      "(scope grows automatically as suites land).",
  );
  process.exit(0);
}

// lcov is only needed once there is something to merge and gate.
requireLcov();

// ── 2+3. normalize SF paths and run the completeness check ──────────────────
const reports = [];
for (const file of allLcov) {
  const workspaceDir = path.resolve(path.dirname(file), "..");
  const workspace = toRepoRelative(workspaceDir);
  const raw = readFileSync(file, "utf8");
  const sfSeen = new Set();

  /**
   * Resolve one SF value to a repo-relative path. bun/vitest emit paths
   * relative to the workspace cwd, jest emits absolute paths, and a
   * normalized file restored from the turbo cache already carries
   * repo-relative paths (normalization must be idempotent), so prefer a
   * candidate that actually exists on disk. Separators are unified first:
   * some vitest configs emit repo-relative paths built with the HOST
   * separator (backslashes), which never match a posix completeness walk.
   */
  const resolveSf = (value) => {
    const unify = (p) => p.split(/[\\/]/).join("/");
    if (path.isAbsolute(value)) return toRepoRelative(value);
    const fromRepoRoot = unify(value);
    if (existsSync(path.join(repoRoot, ...fromRepoRoot.split("/"))))
      return fromRepoRoot;
    return unify(toRepoRelative(path.resolve(workspaceDir, value)));
  };

  const normalized = raw
    .split("\n")
    .map((line) => {
      if (!line.startsWith("SF:")) return line;
      const repoRelative = resolveSf(line.slice(3).trim());
      sfSeen.add(repoRelative);
      return `SF:${repoRelative}`;
    })
    .join("\n");

  writeFileSync(file, normalized);

  const missing = walkSources(path.join(workspaceDir, "src"))
    .map(toRepoRelative)
    .filter((source) => !isExcludedSource(source) && !sfSeen.has(source));
  if (missing.length > 0) {
    fail(
      `completeness check failed for ${workspace}: the following non-excluded source files ` +
        `never appear in coverage (untested modules are invisible to a 100% gate):\n  ` +
        missing.join("\n  "),
    );
  }

  reports.push(file);
  console.log(
    `coverage-gate: normalized ${toRepoRelative(file)} (${workspace})`,
  );
}

// ── 4. merge, strip excludes, gate ───────────────────────────────────────────
const mergedFile = path.join(repoRoot, "coverage-merged.info");
const gatedFile = path.join(repoRoot, "coverage-gated.info");

const merge = spawnSync(
  "lcov",
  [
    ...reports.flatMap((file) => ["--add-tracefile", file]),
    "--output-file",
    mergedFile,
    // lcov 2.x aggregates branch records only when branch coverage is on;
    // without this the merged file silently loses BRDA and the branch gate
    // reports "No branches found".
    "--rc",
    "branch_coverage=1",
    // v8-coverage remappers can drop DA line records inside `v8 ignore`
    // regions while their BRDA branch records survive; lcov 2.x flags the
    // mismatch as corrupt/inconsistent even though the data is fine.
    "--ignore-errors",
    "inconsistent,corrupt",
  ],
  { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" },
);
if (merge.status !== 0) fail("lcov merge failed.");

const remove = spawnSync(
  "lcov",
  [
    "--remove",
    mergedFile,
    ...LCOV_EXCLUDES,
    "--output-file",
    gatedFile,
    // lcov 2.x drops branch records from the output unless branch coverage is
    // on for the filtering run as well.
    "--rc",
    "branch_coverage=1",
    // lcov 2.x errors on exclude patterns that match nothing; which patterns
    // match depends on which workspaces report coverage, so tolerate them.
    // `inconsistent,corrupt`: see the merge step (v8 ignore regions).
    "--ignore-errors",
    "unused,inconsistent,corrupt",
  ],
  { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" },
);
if (remove.status !== 0) fail("lcov --remove failed.");

const summaryArgs = [
  "--summary",
  gatedFile,
  // lcov 2.x only evaluates branch data (and --fail-under-branches) when
  // branch coverage is enabled for the summary run.
  "--rc",
  "branch_coverage=1",
  "--fail-under-lines",
  "100",
  // `inconsistent,corrupt`: see the merge step (v8 ignore regions).
  "--ignore-errors",
  "inconsistent,corrupt",
];
// Older lcov builds (e.g. Ubuntu apt) reject --fail-under-branches as an
// unknown option. Probe once; when unsupported, enforce the branch bar by
// parsing the summary text instead of relying on the exit code.
const probe = spawnSync(
  "lcov",
  ["--summary", gatedFile, "--fail-under-branches", "100"],
  {
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);
const probeOutput = `${probe.stdout ?? ""}${probe.stderr ?? ""}`;
const supportsFailUnderBranches =
  probe.status === 0 && !/Unknown option/i.test(probeOutput);
if (supportsFailUnderBranches) summaryArgs.push("--fail-under-branches", "100");

const summary = spawnSync("lcov", summaryArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (summary.status !== 0) {
  fail(
    `coverage below the 100% bar (lines + branches) across ${reports.length} tracefile(s).`,
  );
}
if (!supportsFailUnderBranches) {
  const check = spawnSync("lcov", summaryArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const branchRate = Number(
    /branches\S*\s*:\s*([\d.]+)%/.exec(check.stdout ?? "")?.[1] ?? "0",
  );
  if (!(branchRate >= 100)) {
    fail(
      `branch coverage ${branchRate}% is below the 100% bar across ${reports.length} tracefile(s).`,
    );
  }
}
console.log(
  `coverage-gate: 100% lines + branches across ${reports.length} tracefile(s).`,
);
