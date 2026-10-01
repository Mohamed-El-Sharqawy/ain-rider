# Research: coverage tooling for a bun+vitest turbo monorepo

Ticket: [#6](https://github.com/Mohamed-El-Sharqawy/ain-rider/issues/6)
Status: decided. Research only; no application code changed.

Question: how to measure, merge, and gate 100% line+branch coverage across a
turbo monorepo mixing `bun:test` (4 elysia services), vitest (4 nest services,
8 shared packages, dashboard), and jest-expo (mobile, excluded from the merged
gate).

## Decision (TL;DR)

1. **Standardize every runner on lcov output.** lcov is the only coverage
   format that bun:test, vitest, and jest can all emit. Istanbul JSON
   (coverage-final.json) is emitted by vitest and jest but **not by bun**, so
   the istanbul toolchain (nyc) cannot merge all three.
2. **Provider choice:** vitest stays on its default `v8` provider (since
   Vitest 3.2 its AST-based remapping produces reports identical to Istanbul,
   including branches); jest-expo keeps its default babel/istanbul provider;
   bun uses its built-in coverage (neither istanbul nor V8, see below).
3. **Merge + gate with the `lcov` CLI in CI** (ubuntu runner):
   `lcov --add-tracefile` to merge, `lcov --remove` to apply repo excludes,
   `--fail-under-lines 100 --fail-under-branches 100` to gate. Plus a small
   normalize script that makes file paths repo-relative and checks that every
   non-excluded source file actually appears in coverage (needed because bun
   only reports files that were loaded during tests).
4. **turbo `test` task gets `outputs: ["coverage/**"]`** so each workspace's
   `coverage/lcov.info` is cached and restored, then merged at the root.
5. **Known gap, accepted and documented:** `bun test` coverage tracks lines and
   functions only, with **no branch data at all** (verified empirically and per
   docs). The 4 elysia services are therefore gated on 100% lines (+functions)
   only; the lines+branches gate fully applies to all vitest workspaces. If
   branch coverage on elysia services becomes mandatory, dual-run their tests
   under vitest istanbul (see "Options for closing the bun branch gap").
6. **CI reporting:** each runner prints a text summary; the merged report and
   per-workspace lcov files are uploaded as workflow artifacts; optional
   Codecov upload (codecov-action v5, `files` + per-workspace `flags`) for PR
   annotations and a hosted trend view.

## Facts per runner (primary sources)

### bun test (elysia services: api-gateway, location-service, match-service, websocket-server)

From Bun's official coverage docs:

- `bun test --coverage` prints a text table; `--coverage-reporter` supports
  **only `text` and `lcov`** (default `text`). There is no istanbul/json
  reporter. Output dir defaults to `coverage/`.
- bunfig.toml `[test]` keys: `coverage`, `coverageReporter`,
  `coverageDir`, `coverageSkipTestFiles` (default false, test files are
  otherwise included), `coveragePathIgnorePatterns` (globs, applied to both
  text and lcov output), and `coverageThreshold`.
- `coverageThreshold` accepts a fraction (e.g. `0.9`) or
  `{ lines = ..., functions = ..., statements = ... }`. **There is no branches
  key**; the report itself only shows `% Funcs` and `% Lines`.
- Coverage counts only files **loaded during the test run** (no "all files"
  mode); sourcemaps are applied to original sources automatically.

Verified empirically on Bun 1.2.21 (scratch project, 2026-09-30):

- `bun test --coverage --coverage-reporter=lcov` writes `coverage/lcov.info`.
- The lcov records contain only `TN/SF/FNF/FNH/DA/LF/LH`; **no `BRDA/BRF/BRH`
  branch records**. The branch dimension does not exist in bun's data model.
- `SF:` paths are **relative to the cwd where `bun test` ran** (the workspace
  dir under turbo), not absolute.
- The text-only run (`--coverage` without a file reporter) writes no files.

Sources: <https://bun.com/docs/test/coverage>, <https://bun.com/docs/cli/test>,
local experiment (Bun 1.2.21).

### vitest (nest services, shared packages, dashboard)

From the official Vitest guide and coverage config reference:

- Providers: `v8` (default) and `istanbul`. **Since Vitest 3.2.0 the v8
  provider uses AST-based remapping (`ast-v8-to-istanbul`) and produces
  coverage reports identical to Istanbul**, including branch data. So the v8
  provider is fine for a strict 100% lines+branches gate; istanbul remains the
  fallback for any environment where V8 coverage is unavailable (the v8
  provider does not work on Bun or non-V8 runtimes, which does not matter here:
  vitest workspaces all run on Node).
- Only files imported during the run are reported by default. To make a 100%
  gate meaningful, set `coverage.include` (e.g. `['src/**/*.{ts,tsx}']`) so
  uncovered files appear in the report; `coverage.exclude` then carves out the
  non-source paths.
- `coverage.thresholds` supports `lines/functions/branches/statements`,
  per-file checks (`perFile`), per-glob thresholds, and a `100: true` shortcut.
  Threshold violations fail the run (exit code != 0). At exactly 100%,
  aggregate and per-file thresholds are equivalent (one uncovered line anywhere
  drops the aggregate below 100), so no perFile distinction is needed.
- Reporters: any istanbul reporter; relevant here: `text-summary`,
  `lcovonly` (lcov.info only, no html), `lcov` (lcov.info + html),
  `json` (istanbul coverage-final.json, not used in the merged pipeline),
  `html`.
- `coverage.reportOnFailure: false` by default: no report when tests fail
  (acceptable; turbo/CI already fails the job on red tests).

Sources: <https://vitest.dev/guide/coverage>
([repo source](https://github.com/vitest-dev/vitest/blob/main/docs/guide/coverage.md),
[config reference](https://github.com/vitest-dev/vitest/blob/main/docs/config/coverage.md)),
[Vitest 3.2 announcement](https://vitest.dev/blog/vitest-3-2#coverage-v8-ast-aware-remapping).

### jest / jest-expo (mobile)

- jest-expo is the standard Expo preset (mocks native modules, extends jest
  config). Jest's default `coverageProvider` is `'babel'` (babel-plugin-istanbul
  instrumentation) which tracks lines, branches, functions, statements.
  `coverageReporters` default is `['json', 'text', 'lcov', 'clover']`, so
  lcov is already in the default set; `collectCoverageFrom` makes coverage
  include all matching files (all-files mode). `coverageThreshold` supports
  global and per-path `lines/branches/functions/statements`.
- Expo's own docs enable `collectCoverage: true` + `collectCoverageFrom` and
  read the generated `coverage/lcov-report/index.html`.
- **Mobile stays out of the merged repo gate** (jest-expo mocks the native
  layer, so its numbers describe the mocked environment; e2e for mobile is a
  separate map item). Its lcov shape is identical, so it can be added to the
  merge later with one glob change if wanted.

Sources: <https://docs.expo.dev/develop/unit-testing/>,
<https://jestjs.io/docs/configuration#coveragereporters> (defaults also visible
in the jest repo config: <https://github.com/jestjs/jest/tree/main/packages/jest-config>).

## Merging options compared

| Tool                                                                                                 | Input format            | Works for bun?                         | Works for vitest/jest?              | Gate support                                           | Verdict                                                                   |
| ---------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------- | ----------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| nyc / istanbul-lib (`nyc merge`, `nyc report`, `nyc check-coverage --per-file`)                      | istanbul JSON only      | **no** (bun cannot emit istanbul JSON) | yes                                 | yes (`check-coverage --lines 100 --branches 100`)      | rejected as the global pipeline; viable for a vitest+jest-only subset     |
| c8                                                                                                   | V8 coverage JSON        | no (bun is JavaScriptCore)             | node-run vitest only                | partial                                                | rejected                                                                  |
| vitest `coverage.mergeReports`                                                                       | vitest's own reports    | no                                     | vitest projects within one run only | via thresholds                                         | rejected (cannot ingest bun/jest output)                                  |
| lcov CLI (`--add-tracefile`, `--remove`, `--extract`, `--fail-under-lines`, `--fail-under-branches`) | lcov tracefiles         | yes                                    | yes                                 | yes (fail-under-lines/branches)                        | **chosen**: one off-the-shelf tool for merge + exclude-filter + 100% gate |
| lcov-result-merger (npm)                                                                             | lcov                    | yes                                    | yes                                 | no gate                                                | redundant if lcov CLI is available                                        |
| Codecov (service)                                                                                    | any (server-side merge) | yes                                    | yes                                 | status checks with `target: 100%`, flags per workspace | optional reporting layer, not the enforcement gate (vendor dependency)    |

lcov facts used above: `--add-tracefile` aggregates tracefiles by summing hit
counts; `--remove`/`--extract` filter records by glob patterns;
`--fail-under-lines` / `--fail-under-branches` make `lcov --summary` exit
non-zero below the threshold (aggregate check; at 100% aggregate == per-file).
Source: <https://github.com/linux-test-project/lcov> (lcov man pages; included
in GitHub's ubuntu images, otherwise `apt-get install lcov`; needs perl, so it
is a CI-on-linux tool, not a Windows-local tool).

Why not gate purely per-runner? It would work for vitest/jest (native
thresholds) but bun has no branch threshold and no per-file all-files mode, so
a root-level merged gate is the only place where the excludes and the
completeness check can be applied uniformly.

## Recommended setup

### 1. elysia services (bun:test)

`apps/backend/apps/elysia/*/bunfig.toml` (or flags in the workspace `test`
script; turbo runs the script, so script flags are equally fine):

```toml
[test]
coverage = true
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
coveragePathIgnorePatterns = [
  "node_modules/",
  "dist/",
  "src/generated/",
  "prisma/",
  "*.config.*",
  "src/index.ts",        # bootstrap
]
# fractions, not percentages; no branches key exists
coverageThreshold = { lines = 1.0, functions = 1.0 }
```

Notes: `src/generated/` and `prisma/` cover the generated prisma client
(adjust to the real generated output paths once prisma lands); `src/index.ts`
is the bootstrap entry that wires plugins and listens. bun gives fast local
feedback on lines/functions; the merged CI gate re-checks with the same lcov.

### 2. vitest workspaces (nest services, runtime shared packages, dashboard)

One shared base config (e.g. in `packages/config`), re-exported by each
workspace:

```ts
// vitest.base.config.ts
import { defineConfig } from "vitest/config";

export const baseCoverage = {
  provider: "v8", // default; istanbul-identical since vitest 3.2
  include: ["src/**/*.{ts,tsx}"], // all-files mode: uncovered files must appear
  exclude: [
    "src/generated/**",
    "src/**/*.d.ts",
    "src/main.ts", // bootstrap (nest entrypoint / dashboard main.tsx)
    "src/index.ts", // package barrels that only re-export
  ],
  reporter: ["text-summary", "lcovonly"],
  thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
};
```

Each workspace's `test` script: `vitest run --coverage`. Local thresholds fail
fast per workspace; the merged CI gate is the authoritative check. The
`shared-types` package is excluded from testing entirely (per map: pure types).

### 3. mobile (jest-expo), not in the merged gate

```jsonc
// package.json (jest stanza)
"jest": {
  "preset": "jest-expo",
  "collectCoverage": true,
  "collectCoverageFrom": ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  "coverageReporters": ["text-summary", "lcovonly"]
}
```

Kept as a per-workspace signal; `apps/mobile/coverage/lcov.info` is excluded
from the root merge glob until the team decides otherwise.

### 4. turbo.json

```jsonc
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
    },
  },
}
```

`outputs` is what tells turbo to cache and restore files; without it, cache
hits restore nothing, and the merge step would see stale or missing lcov
files. With it, `turbo run test` (local and CI, incl. remote cache) leaves a
fresh `coverage/lcov.info` in every workspace that ran tests.
Source: <https://turborepo.com/docs/crafting-your-repository/configuring-tasks>
(also shipped inside the installed `node_modules/turbo/docs`).

### 5. Merge + gate (root, CI on ubuntu)

Two steps: a tiny normalize script (node, no deps) and the lcov CLI.

`scripts/coverage-normalize.mjs` (sketch):

```ts
// For each glob match apps/backend/apps/**/coverage/lcov.info,
// apps/backend/packages/**/coverage/lcov.info, apps/dashboard/coverage/lcov.info:
// 1. rewrite every SF: path to a repo-relative, forward-slashed path
//    (resolve against the workspace dir: bun writes cwd-relative SF,
//     vitest writes projectRoot-relative SF; jest may write absolute paths)
// 2. completeness check: every workspace file matching src/**/*.{ts,tsx}
//    that is not in the exclude list MUST appear in some SF record
//    (bun only reports loaded files, so an entirely untested module would
//     otherwise be invisible and silently pass a 100% gate)
// 3. write the normalized file back
```

Why normalization matters: bun and vitest both emit workspace-relative `SF:`
paths; two workspaces can both have `src/index.ts` and `lcov --add-tracefile`
would fuse them into one record, corrupting the gate. The completeness check
exists because bun has no all-files mode (vitest solves this via
`coverage.include`, jest via `collectCoverageFrom`).

Merge + exclude + gate (pwsh or bash step in CI):

```sh
sudo apt-get install -y lcov   # idempotent; already on GH ubuntu images

ARGS=""
for f in $(find apps -name lcov.info -path '*/coverage/*' -not -path '*mobile*'); do
  ARGS="$ARGS --add-tracefile $f"
done
lcov $ARGS -o coverage-merged.info
lcov --remove coverage-merged.info \
  '*/generated/*' '*/prisma/*' '*/node_modules/*' '*/dist/*' \
  '*/src/main.ts' '*/src/index.ts' '*.config.*' '*/shared-types/*' \
  -o coverage-gated.info
lcov --summary coverage-gated.info \
  --fail-under-lines 100 --fail-under-branches 100
genhtml coverage-gated.info -o coverage-html   # optional browsable report
```

`--fail-under-branches 100` holds all vitest/jest files to full branch
coverage; bun files simply carry no branch records (aggregate branch math is
unaffected by them).

### 6. GitHub Actions sketch

```yaml
test-coverage:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - uses: oven-sh/setup-bun@v2
    - run: pnpm install --frozen-lockfile
    - run: pnpm build # turbo; generates prisma clients etc.
    - run: pnpm test # turbo run test; coverage/** restored from cache on hits
    - run: node scripts/coverage-normalize.mjs
    - run: sudo apt-get install -y lcov && bash scripts/coverage-gate.sh
    - uses: actions/upload-artifact@v4
      with:
        name: coverage
        path: |
          coverage-*.info
          coverage-html/
    # optional PR reporting layer:
    - uses: codecov/codecov-action@v5
      with:
        files: ./apps/backend/apps/nest/auth-service/coverage/lcov.info,... # or a pre-joined list
        flags: backend
        token: ${{ secrets.CODECOV_TOKEN }}
```

Codecov action facts: v5+ uses the wrapper/CLI, supports multi-file `files`,
per-group `flags`, `fail_ci_if_error`; server-side merge and 100% status
targets are configured in codecov.yml.
Source: <https://github.com/codecov/codecov-action> (README).

## Options for closing the bun branch gap (if ever required)

1. **Accept (recommended now):** elysia services gate on 100% lines+functions
   via bun + the merged lines gate. Documented residual risk: untested branch
   paths in the 4 elysia services are not counted.
2. **Dual-run elysia tests under vitest istanbul on Node, coverage-only:**
   bun:test's API is jest-compatible, so a shim module re-exporting
   `test/describe/expect/mock/beforeEach/...` from vitest plus a resolve alias
   `'bun:test' -> shim` lets the same `*.test.ts` files run under vitest with
   the istanbul provider (works on any runtime), producing branch data that
   feeds the same lcov pipeline. Costs: a second runner config per elysia
   workspace, and any bun-only APIs exercised in tests need Node-compatible
   substitutes. Only worth it for pure-logic services (fare calc, matching
   rules); keep bun:test as the primary dev runner.
3. Wait for upstream: bun has no branch coverage as of Bun 1.3 docs; re-check
   `bun.com/docs/test/coverage` each upgrade.

## Sources

- Bun coverage docs: https://bun.com/docs/test/coverage
- Bun test CLI docs: https://bun.com/docs/cli/test
- Local verification on Bun 1.2.21 (lcov contains no BRDA/BRF/BRH; SF paths
  relative to cwd; text-only run writes no files)
- Vitest coverage guide: https://vitest.dev/guide/coverage
- Vitest coverage config reference:
  https://github.com/vitest-dev/vitest/blob/main/docs/config/coverage.md
- Vitest 3.2 AST-aware v8 remapping:
  https://vitest.dev/blog/vitest-3-2#coverage-v8-ast-aware-remapping
- nyc README (merge/report/check-coverage, per-file thresholds, istanbul JSON
  basis): https://github.com/istanbuljs/nyc
- lcov CLI (add-tracefile/remove/extract/fail-under-lines/fail-under-branches):
  https://github.com/linux-test-project/lcov
- Expo unit testing (jest-expo, collectCoverageFrom, lcov report):
  https://docs.expo.dev/develop/unit-testing/
- Jest configuration (coverageProvider/coverageReporters/coverageThreshold):
  https://jestjs.io/docs/configuration
- Turborepo task configuration (outputs):
  https://turborepo.com/docs/crafting-your-repository/configuring-tasks
  and the bundled copy in node_modules/turbo/docs (matches installed turbo 2.5.x)
- Codecov action: https://github.com/codecov/codecov-action
