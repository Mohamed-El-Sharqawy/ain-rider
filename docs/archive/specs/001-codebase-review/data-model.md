# Data Model: Codebase Review Documents

**Feature**: 001-codebase-review
**Date**: 2026-04-07

## Entity: Review Document

A single markdown file containing all findings for a logical domain within a
workspace.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Document title (e.g., "API Gateway Code Review") |
| `workspace` | enum | `backend` \| `mobile` \| `dashboard` \| `shared` |
| `domain` | string | Logical domain (e.g., "api-gateway", "screens", "pages") |
| `files_covered` | string[] | List of all source files reviewed in this document |
| `findings` | Finding[] | All findings discovered during review |
| `summary` | string | Brief overview of the domain's code health |

## Entity: Finding

A single issue, bottleneck, or improvement opportunity discovered during review.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier within document (e.g., "BGW-001") |
| `severity` | enum | `critical` \| `high` \| `medium` \| `low` |
| `category` | enum | `bug` \| `security` \| `performance` \| `edge-case` \| `architecture` \| `code-quality` \| `integration` |
| `title` | string | Short descriptive title |
| `file_path` | string | Absolute or relative path to the source file |
| `line_number` | number? | Line number if applicable |
| `description` | string | What is wrong and why it matters |
| `impact` | string | What happens if not addressed |
| `recommendation` | string | Specific fix or improvement with code-level guidance |
| `cross_cutting` | boolean | Whether this finding spans multiple workspaces |
| `related_findings` | string[] | IDs of related findings in other documents |

## Entity: Roadmap Entry

A prioritized entry in the consolidated roadmap document.

| Field | Type | Description |
|-------|------|-------------|
| `finding_id` | string | Reference to the source finding (e.g., "AUTH-003") |
| `severity` | enum | `critical` \| `high` \| `medium` \| `low` |
| `workspace` | enum | `backend` \| `mobile` \| `dashboard` \| `shared` |
| `title` | string | Short title from the finding |
| `source_doc` | string | Path to the review document containing details |
| `estimated_effort` | string | Small / Medium / Large |
| `dependencies` | string[] | Other roadmap entries that must be fixed first |

## Enum: Severity

| Value | Weight | Action Required |
|-------|--------|----------------|
| `critical` | 4 | Fix immediately — blocks further development |
| `high` | 3 | Fix before next feature sprint |
| `medium` | 2 | Backlog — address in next iteration |
| `low` | 1 | Nice-to-have — address when convenient |

## Enum: Category

| Value | Description |
|-------|-------------|
| `bug` | Incorrect logic that produces wrong results |
| `security` | Vulnerability or unauthorized access path |
| `performance` | Bottleneck or inefficient pattern |
| `edge-case` | Unhandled boundary condition or error state |
| `architecture` | Structural concern (coupling, missing abstraction) |
| `code-quality` | Style, maintainability, type safety |
| `integration` | Mismatch between two workspaces |

## Relationships

```
Review Document 1──* Finding
Roadmap Entry *──1 Finding
Finding *──* Finding (related_findings)
```

## State Transitions

Findings do not have a state machine — they are static observations. The roadmap
tracks resolution status separately:

```
[NONE] → OPEN (finding documented in review)
OPEN → IN-PROGRESS (developer starts fixing)
IN-PROGRESS → FIXED (code change merged)
OPEN → DEFERRED (explicitly deferred with rationale)
```

Note: Resolution status tracking is managed via issue tracker, not in the
review documents themselves. The roadmap document uses a checkbox format.
