# Implementation Plan: Comprehensive Codebase Code Review

**Branch**: `001-codebase-review` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-codebase-review/spec.md`

## Summary

Produce a comprehensive code review of the entire Ain Rider platform codebase
(backend, mobile, dashboard) organized into structured documentation under a
`docs/` directory. Each workspace gets its own subdirectory with dedicated
review documents covering issues, edge cases, bottlenecks, and architectural
improvements. A `docs/shared/` directory captures cross-platform integration
problems (backend↔mobile, backend↔dashboard, shared type mismatches). A
consolidated prioritized roadmap ties all findings together.

## Technical Context

**Language/Version**: TypeScript strict (all workspaces)
**Primary Dependencies**: N/A — this is a documentation/analysis feature, not a
code feature. The review reads existing source code across backend (Elysia/Bun +
NestJS/Node 22), mobile (Expo SDK 54 / React Native), and dashboard (React 19 /
Vite 8).
**Storage**: Markdown files in `docs/` directory (no database)
**Testing**: Manual verification — confirm every review document references real
source files and every finding has a severity + recommended fix
**Target Platform**: Developer documentation (markdown files in repository)
**Project Type**: Documentation / code audit
**Performance Goals**: N/A
**Constraints**: Reviews must reference actual file paths in the codebase;
findings must be actionable (not theoretical); severity classification must be
consistent across all documents
**Scale/Scope**: ~80+ source files across backend (8 services + 7 packages),
mobile (~40 screens/components/hooks/stores/services), dashboard (~30 pages/
components/services/hooks)

## Constitution Check

*GATE: Must pass before speckit Phase 0 (research). Re-check after speckit Phase 1 (design).*

| Principle | Gate | Status |
|-----------|------|--------|
| I. On-Premise Sovereignty | Review MUST flag any external cloud dependency found in application code | ✅ Covered — review includes security/dependency audit |
| II. Gateway-Only Client Access | Review MUST verify mobile and dashboard only call api-gateway endpoints | ✅ Covered — integration review checks routing |
| III. TypeScript Strict Mode | Review MUST flag `any` usage, missing strict mode, and type safety violations | ✅ Covered — code quality review |
| IV. Shared Types as Contract | Review MUST flag type mismatches between shared-types and local DTOs/types | ✅ Covered — cross-platform integration review |
| V. Structured Error Contract | Review MUST verify all error responses follow the unified schema | ✅ Covered — backend and client error handling review |
| VI. Real-Time by Design | Review MUST verify WebSocket/NATS event handling consistency | ✅ Covered — real-time integration review |
| VII. Egypt-First Localization | Review MUST flag missing Arabic/RTL/EGP conventions | ✅ Covered — mobile and dashboard UI review |

**Post-Design Re-check**: ✅ All gates remain satisfied. The documentation
structure does not introduce any constitution violations.

## Implementation Phases

Implementation phases are defined in `tasks.md`:

| Phase | Name | Tasks | Description |
|-------|------|-------|-------------|
| 1 | Setup | T001-T002 | Directory structure and README |
| 2 | Backend Review | T003-T012 | 10 backend service/package reviews |
| 3 | Mobile Review | T013-T017 | 5 mobile domain reviews |
| 4 | Dashboard Review | T018-T021 | 4 dashboard reviews (pages in dashboard/; components, data-fetching, auth-websocket in shared/) |
| 5 | Integration | T022-T024 | 3 cross-platform integration reviews |
| 6 | Roadmap | T025 | Consolidated prioritized roadmap |
| 7 | Validation | T026 | Final quality check |

**Note**: Phases 2, 3, and 4 can run in parallel after Phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/001-codebase-review/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Review methodology & coverage decisions
├── data-model.md        # Phase 1: Document structure & finding schema
├── quickstart.md        # Phase 1: How to use the review documents
├── contracts/           # Phase 1: Review document format contracts
│   └── review-document-format.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (completed)
└── tasks.md             # Phase 2: Task breakdown (created by /speckit.tasks)
```

### Output Documentation (repository root)

```text
docs/
├── backend/
│   ├── README.md                 # Backend findings summary and index
│   ├── api-gateway.md            # API gateway service review
│   ├── auth-service.md           # Auth service review
│   ├── trip-service.md           # Trip service review
│   ├── payment-service.md        # Payment service review
│   ├── admin-service.md          # Admin service review
│   ├── location-service.md       # Location service review
│   ├── match-service.md          # Match service review
│   ├── websocket-server.md       # WebSocket server review
│   ├── shared-packages.md        # Shared packages review (7 packages)
│   └── prisma-schemas.md         # Prisma schema review across all services
├── mobile/
│   ├── screens.md                # All screens review (rider + driver)
│   ├── stores.md                 # Zustand stores review
│   ├── api.md                    # API client + modules review
│   ├── hooks-services.md         # Hooks, services, and utilities review
│   └── navigation.md             # Navigation and auth flow review
├── dashboard/
│   └── pages.md                  # All 11 feature pages review
├── shared/
│   ├── auth-flow-comparison.md         # Auth flow consistency across all platforms
│   ├── auth-websocket.md               # Auth + WebSocket integration (cross-platform)
│   ├── components.md                   # Shared component quality review
│   ├── data-fetching.md                # Data fetching patterns (cross-platform)
│   ├── mobile-backend-crossref.md      # Backend↔Mobile contract mismatches
│   └── dashboard-backend-crossref.md   # Backend↔Dashboard contract mismatches
├── ROADMAP.md                     # Consolidated prioritized roadmap
└── README.md                     # Index and navigation for all review docs
```

**Structure Decision**: The output is organized by workspace (backend/mobile/
dashboard/shared). Dashboard-specific component, data-fetching, and auth reviews
are consolidated into `docs/shared/` because they cover cross-platform patterns
and share findings with mobile. This avoids duplication while keeping the
dashboard page review in its own directory. The backend directory includes its
own `README.md` summarizing findings across all services.
