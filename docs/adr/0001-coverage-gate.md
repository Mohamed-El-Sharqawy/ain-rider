# Coverage gate: 100% on hand-written source, branches where the runtime can report them

The repo enforces a 100% coverage bar on hand-written source through one merged lcov gate (`scripts/coverage-gate`) in CI. bun:test 1.2.x emits no branch data (its lcov records carry no BRDA), so the four elysia services are gated on 100% lines and functions only. All vitest workspaces (the nest services, the backend packages, and the dashboard) are gated on 100% lines, branches, functions, and statements. The merged gate applies one `--fail-under` pair: branches are measured only where branch records exist, so elysia files never dilute the branch bar. Mobile (jest-expo) reports coverage as a local signal and is not part of the merged gate.

## Considered Options

- Force branch parity by dual-running elysia tests under vitest-istanbul through a bun:test shim. Rejected: extra machinery for four services, and the gap is accepted. The path stays documented in `docs/research/coverage-tooling.md` if the bar must tighten later.
- Ratchet the gate up from current numbers. Rejected: each tests ticket lands with its workspace already at 100%, so no ratchet period is needed. The gate scope grows automatically because the merge only picks up workspaces that emit `coverage/lcov.info`.

## Consequences

- The canonical exclude list lives in the root gate script: `*/generated/*`, `*/node_modules/*`, `*/dist/*`, `*.d.ts`, bootstrap entries (`*/src/main.ts`, `*/src/main.tsx`), barrels (`*/src/index.ts`), `*.config.*`, and the shared-types package. Hand-written `src/prisma/*` modules and `app.module.ts` count toward the gate; the research doc's `*/prisma/*` glob was dropped because it also stripped hand-written prisma modules.
- `@ain-rider/test-utils` counts toward the gate. It is hand-written source with tests.
- A completeness check fails the gate when a non-excluded source file never appears in coverage. bun only reports files loaded during tests, so an untested module would otherwise be invisible to the 100% bar.
- Each vitest workspace also sets `coverage.thresholds = 100` so `vitest run --coverage` fails fast locally; the merged gate stays the authoritative check.
- Locally, the gate uses lcov from PATH and falls back to a docker container (node:22-slim + lcov) when lcov is missing. CI installs lcov natively on the Linux runner; deployment targets are Linux.
