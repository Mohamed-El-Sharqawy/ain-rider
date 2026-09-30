# ain-rider Development Guidelines

## Project Structure

One turbo monorepo. pnpm workspaces manage the packages. Turbo runs the tasks.

```text
apps/backend/    backend monorepo: 8 services (4 elysia, 4 nest) + 8 shared packages
apps/dashboard/  admin dashboard (Vite + React)
apps/mobile/     rider and driver app (Expo, React Native)
docs/            project documentation; docs/archive holds the old speckit specs
```

## Commands

Run from the repository root:

- `pnpm install` - install all dependencies
- `pnpm build` - build all packages and apps (turbo, cached)
- `pnpm test` - run all tests
- `pnpm lint` - lint all packages
- `pnpm dev` - start all dev servers
- `pnpm -C apps/backend docker:infra:up` - start infra (postgres, nats, redis, minio)

## Rules

- Use pnpm only. Do not add package-lock.json, yarn.lock, or bun.lock files for the workspace.
- The elysia services use bun as their runtime. The `start` and `build` scripts call bun. pnpm still installs the dependencies.
- The root `.npmrc` sets `node-linker=hoisted`. Expo and Metro need this. Do not remove it.
- Secrets stay out of git. `.env` files and the firebase adminsdk key are ignored.

## Code Style

TypeScript strict in all workspaces. Follow standard conventions.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical defaults are used as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: root `CONTEXT-MAP.md` pointing at per-app `CONTEXT.md` files. See `docs/agents/domain.md`.

### Implementation workflow

Every `ready-for-agent` ticket gets its own branch and lands as a PR. The human reviews and merges; agents never push to `main` and never merge PRs unless told to. Multiple tickets run in parallel when they have no blocking edge: shared-tree subagents if file sets are disjoint, git worktrees if they overlap. See `docs/agents/implementation.md`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
