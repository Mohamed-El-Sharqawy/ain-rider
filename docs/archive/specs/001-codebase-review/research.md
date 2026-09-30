# Research: Comprehensive Codebase Code Review

**Feature**: 001-codebase-review
**Date**: 2026-04-07

## Decision 1: Review Document Granularity

**Decision**: One document per logical domain per workspace (not one per file).

**Rationale**: The codebase has ~80+ source files. One document per file would
produce 80+ markdowns, making navigation harder. Grouping by logical domain
(screens, state management, API integration, etc.) keeps the review digestible
while maintaining full coverage. The roadmap document cross-references findings
back to specific files.

**Alternatives Considered**:
- One document per source file: Too granular, excessive navigation overhead
- One document per workspace: Too broad, hard to find specific issues
- One document per concern (all bugs, all perf, all security): Forces reader to
  jump between workspaces for a single concern

## Decision 2: Finding Severity Classification

**Decision**: Four-level severity model aligned with the spec:

| Severity | Criteria | Examples |
|----------|----------|---------|
| Critical | Data loss, security vulnerability, crash, money loss | SQL injection, unauthenticated admin routes, double-charge race condition |
| High | Incorrect business logic, race condition, broken integration | Trip stuck in wrong state, driver not removed from available pool after match, mobile shows wrong fare |
| Medium | Poor UX, missing edge case, inconsistency | Missing loading state, no retry on network failure, inconsistent error messages |
| Low | Code quality, style, optimization opportunity | Unused imports, missing TypeScript types, redundant state, extractable shared utility |

**Rationale**: Four levels provide clear prioritization without over-engineering.
Critical and High findings block further feature development. Medium findings
should be addressed in the next iteration. Low findings are backlog items.

**Alternatives Considered**:
- Three levels (no medium): Loses the distinction between "broken" and "suboptimal"
- Five levels (add "info"): Adds a level that never gets acted on
- Numeric (1-10): Too subjective, hard to calibrate across reviewers

## Decision 3: Review Coverage Approach

**Decision**: Full coverage of all source files, not sampling. Each review
document lists every file covered with a brief status (clean / issues found).

**Rationale**: The user wants to continue development "without having any problem
in the old/current code." Sampling could miss critical bugs. The codebase is
manageable in size (~80 files) for full coverage.

**Alternatives Considered**:
- Risk-based sampling: Faster but may miss unexpected issues in "safe" areas
- Automated lint-only: Only catches style issues, not logic bugs or integration
  mismatches

## Decision 4: Cross-Platform Integration Review Method

**Decision**: For each API endpoint consumed by mobile or dashboard, trace the
full path: client API module → gateway route → gateway proxy handler → backend
controller → backend service → database query. Verify response shapes, error
codes, and status codes match at each hop.

**Rationale**: Integration bugs live at the boundaries. By tracing the full path,
we catch shape mismatches, missing error handling at the gateway layer, and
incorrect assumptions in client code.

**Alternatives Considered**:
- Contract testing only: Would require setting up test infrastructure first
- Manual endpoint-by-endpoint comparison: Essentially what we're doing, but
  formalized as a documented trace

## Decision 5: Architecture Review Scope

**Decision**: Focus on patterns that affect correctness and maintainability:
service coupling, missing abstractions, inconsistent error handling, NATS event
consistency, and state machine completeness. Do NOT review infrastructure
(Docker, Kubernetes, CI/CD) or propose major architectural overhauls.

**Rationale**: The user wants to "refine" the project and continue working
without problems — not rebuild it. Architecture improvements should be
incremental and low-risk.

**Alternatives Considered**:
- Full architecture audit including infra: Out of scope per spec assumptions
- Skip architecture review: Would miss systemic issues that affect correctness

## Decision 6: Finding Format

**Decision**: Each finding follows a consistent structure:

```markdown
### [SEVERITY] Finding: [Title]
- **File**: `path/to/file.ts:line`
- **Category**: [Bug | Security | Performance | Edge Case | Architecture | Code Quality]
- **Description**: What's wrong and why it matters
- **Impact**: What happens if not fixed
- **Recommendation**: Specific fix with code-level guidance
```

**Rationale**: A consistent format makes findings scannable, sortable, and
actionable. Including file path and line reference allows a developer to jump
directly to the code.

**Alternatives Considered**:
- Free-form prose: Harder to scan and prioritize
- Issue tracker format (title + body only): Lacks structure for severity and
  category classification
