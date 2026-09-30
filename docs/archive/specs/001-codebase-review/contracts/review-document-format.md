# Contract: Review Document Format

**Feature**: 001-codebase-review
**Date**: 2026-04-07

All review documents in `docs/` MUST follow this format.

## Document Header

```markdown
# [Domain Name] Code Review

**Workspace**: [backend | mobile | dashboard | shared]
**Domain**: [e.g., api-gateway, screens, pages]
**Date**: YYYY-MM-DD
**Files Reviewed**: [count] files

## Summary

[1-2 paragraph overview of the domain's code health: what works well,
what needs attention, and the most critical finding]

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `path/to/file.ts` | Issues found | 2 high, 1 medium |
| `path/to/other.ts` | Clean | 0 |

---
```

## Finding Format

```markdown
### [SEVERITY] [ID]: [Title]

- **File**: `path/to/file.ts:[line]`
- **Category**: [bug | security | performance | edge-case | architecture |
  code-quality | integration]
- **Impact**: [What happens if not fixed]

**Description**

[Detailed explanation of the issue with code context]

**Recommendation**

[Specific fix — can include code snippets, file references, or step-by-step
instructions]

---
```

## Severity Badge Format

| Severity | Markdown |
|----------|----------|
| Critical | `🔴 CRITICAL` |
| High | `🟠 HIGH` |
| Medium | `🟡 MEDIUM` |
| Low | `🟢 LOW` |

## ID Convention

Format: `[WORKSPACE_PREFIX]-[NUMBER]`

| Workspace | Prefix |
|-----------|--------|
| Backend: api-gateway | `BGW` |
| Backend: auth-service | `AUTH` |
| Backend: trip-service | `TRIP` |
| Backend: payment-service | `PAY` |
| Backend: admin-service | `ADM` |
| Backend: location-service | `LOC` |
| Backend: match-service | `MTCH` |
| Backend: websocket-server | `WS` |
| Backend: shared-packages | `PKG` |
| Backend: database-schema | `DB` |
| Mobile: screens | `MOB-S` |
| Mobile: state-management | `MOB-ST` |
| Mobile: api-integration | `MOB-API` |
| Mobile: hooks-services | `MOB-HK` |
| Mobile: navigation-auth | `MOB-NA` |
| Dashboard: pages | `DASH-P` |
| Dashboard: components | `DASH-C` |
| Dashboard: data-fetching | `DASH-DF` |
| Dashboard: auth-websocket | `DASH-AW` |
| Shared: backend-mobile | `INT-BM` |
| Shared: backend-dashboard | `INT-BD` |
| Shared: authentication-flow | `INT-AU` |

## Roadmap Document Format

```markdown
# Codebase Review: Prioritized Roadmap

**Date**: YYYY-MM-DD
**Total Findings**: [count]
**Critical**: [count] | **High**: [count] | **Medium**: [count] | **Low**: [count]

## Critical (Fix Immediately)

- [ ] `[ID]` [Title] — [workspace] — [source doc](./path/to/doc.md) — [effort]
- [ ] ...

## High (Fix Before Next Sprint)

- [ ] ...

## Medium (Backlog)

- [ ] ...

## Low (Nice-to-Have)

- [ ] ...

## Cross-Cutting Issues

Issues that span multiple workspaces and require coordinated fixes:

- [ ] `[ID]` [Title] — affects: [workspace list] — [source doc](./path)
```
