# Implementation workflow

Rules for `/implement` and any agent implementing a `ready-for-agent` ticket. These add to the implement skill: the skill's "commit your work to the current branch" means the per-ticket branch this workflow creates.

## Hard rules (always)

1. **One ticket = one branch = one PR.** Branch from latest `main`, named `ticket/<number>-<slug>` (e.g. `ticket/42-add-eta-webhook`).
2. **Push the branch, open a PR** with `gh pr create --base main`. The final report contains the PR link.
3. **Never push to `main`. Never merge, rebase-onto-main, or close a PR.** The human reviews and merges. Only exception: the human explicitly says to merge or push in the same message.
4. **Verify before the PR:** `pnpm lint` plus scoped tests for the affected packages; run the full `pnpm test` once at the end.
5. **No secrets in commits.** `.env` files and the firebase adminsdk key never get staged.

## Single ticket

1. `gh issue view <n> --comments` and self-assign: `gh issue edit <n> --add-assignee @me`
2. `git checkout main && git pull && git checkout -b ticket/<n>-<slug>`
3. Implement (prefer /tdd at pre-agreed seams), verify per rule 4
4. Commit, push, `gh pr create --base main`, report the PR link

## Multiple tickets in parallel

Gate 1 - dependencies: tickets with a blocking edge between them (GitHub issue dependencies, or a `Blocked by: #<n>` line) never run in parallel. The blocker runs first; the dependent ticket starts only after the blocker's PR is merged.

Gate 2 - file overlap: for each ticket, list the files/packages it will touch.

- **Disjoint file sets -> Option A** (parallel subagents, shared working tree)
- **Any overlap -> Option B** (isolated git worktrees, one per ticket)

### Option A - no overlap: parallel subagents in-session (~10-30 min total, the slowest ticket sets the time)

1. `gh issue list --label ready-for-agent`, pick tickets that pass both gates
2. Fire one `task` subagent per ticket in a single message so they run concurrently in the background
3. Each subagent implements and verifies (`pnpm lint`, scoped tests) but commits nothing and switches no branches - they share one working tree
4. When all subagents finish: per ticket, `git checkout -b ticket/<n>-<slug>` from `main`, stage only that ticket's files (disjoint by precondition), commit, push, open the PR
5. Report every PR link in one list

### Option B - overlap: isolated worktrees (+2-5 min setup per ticket)

1. Per ticket: `git worktree add ..\ain-t<n> -b ticket/<n>-<slug>` and `pnpm install` inside it
2. Per ticket, in its own terminal: `opencode run -C ..\ain-t<n> "Implement ticket #<n>: <brief>. Verify with pnpm lint and scoped tests. Commit to the current branch, push, open a PR against main. Do not merge."`
3. Each worktree is fully isolated: own checkout, own branch, own node_modules
4. After PRs are merged: `git worktree remove ..\ain-t<n>` and delete the branch

### Parallelism limits

- Cap concurrent agents at 3-5: each is a full LLM session and a parallel test run.
- Turbo cache and `node_modules` are shared in Option A; concurrent `pnpm test` runs may interleave. Re-verify per branch in step 4 before pushing if a failure looks spurious.
