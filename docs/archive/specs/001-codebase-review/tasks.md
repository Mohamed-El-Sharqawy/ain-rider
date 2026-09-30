---

description: "Task list for comprehensive codebase code review"
---

# Tasks: Comprehensive Codebase Code Review

**Input**: Design documents from `/specs/001-codebase-review/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/review-document-format.md, research.md

**Tests**: Not applicable — documentation feature. Validation is manual.

**Organization**: Tasks grouped by user story. Each task is self-contained with explicit file paths to READ (source code to review) and WRITE (review document to produce).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)

## IMPORTANT: How to Execute Each Review Task

Every review task follows the SAME pattern:
1. **READ** all source files listed in the task description
2. **ANALYZE** for: bugs, security issues, performance bottlenecks, edge cases, architectural concerns, missing error handling, race conditions, type safety violations
3. **WRITE** a markdown review document at the specified output path using the format defined in `specs/001-codebase-review/contracts/review-document-format.md`

Each finding in the review document MUST use this format:

```markdown
### 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW [ID]: [Title]

- **File**: `path/to/file.ts:[line]`
- **Category**: [bug | security | performance | edge-case | architecture | code-quality | integration]
- **Impact**: [What happens if not fixed]

**Description**
[What is wrong and why]

**Recommendation**
[Specific fix with code-level guidance]

---
```

Severity levels:
- 🔴 Critical: data loss, security vulnerability, crash, money loss
- 🟠 High: incorrect logic, race condition, broken integration
- 🟡 Medium: poor UX, missing edge case, inconsistency
- 🟢 Low: code quality, style, optimization

Finding ID prefixes are defined in `specs/001-codebase-review/contracts/review-document-format.md` under "ID Convention" section. Use the correct prefix for each task's output document.

## Path Conventions

- **Source code root**: `D:\Work\ain-rider`
- **Backend code**: `D:\Work\ain-rider\backend\`
- **Mobile code**: `D:\Work\ain-rider\mobile\`
- **Dashboard code**: `D:\Work\ain-rider\dashboard\`
- **Output directory**: `D:\Work\ain-rider\docs\`

---

## Phase 1: Setup (Directory Structure)

**Purpose**: Create the output directory structure and the README index file.

- [x] T001 Create all output directories: `docs/`, `docs/backend/`, `docs/mobile/`, `docs/dashboard/`, `docs/shared/` at `D:\Work\ain-rider`

- [x] T002 Create `D:\Work\ain-rider\docs\README.md` with links. Use this exact content:

  ```markdown
  # Ain Rider Codebase Review

  Comprehensive code review of the entire Ain Rider platform covering backend microservices, mobile app, and admin dashboard.

  ## Backend
  | Document | Focus |
  |----------|-------|
  | [API Gateway](./backend/api-gateway.md) | JWT auth, rate limiting, proxy logic, cookie handling |
  | [Auth Service](./backend/auth-service.md) | Password hashing, OTP, token rotation, onboarding |
  | [Trip Service](./backend/trip-service.md) | State machine, fare calc, cancellation, ratings |
  | [Payment Service](./backend/payment-service.md) | Double-charge prevention, refunds, cash handling |
  | [Admin Service](./backend/admin-service.md) | User management, wallets, promos, audit logging |
  | [Location Service](./backend/location-service.md) | H3 geospatial, Redis state, GPS tracking |
  | [Match Service](./backend/match-service.md) | Race conditions, driver matching, ring search |
  | [WebSocket Server](./backend/websocket-server.md) | Connection auth, subscriptions, message delivery |
  | [Shared Packages](./backend/shared-packages.md) | Type consistency, error handling, idempotency |
  | [Prisma Schemas](./backend/prisma-schemas.md) | Indexes, constraints, enum consistency, relationships |

  ## Mobile
  | Document | Focus |
  |----------|-------|
  | [Screens](./mobile/screens.md) | Error boundaries, loading states, form validation, RTL |
  | [Stores](./mobile/stores.md) | Store consistency, race conditions, cleanup |
  | [API Integration](./mobile/api.md) | Token refresh, type safety, error handling |
  | [Hooks & Services](./mobile/hooks-services.md) | Cleanup, WebSocket reconnect, background tasks |
  | [Navigation](./mobile/navigation.md) | Auth guards, role routing, onboarding flow |

  ## Dashboard
  | Document | Focus |
  |----------|-------|
  | [Pages](./dashboard/pages.md) | Data fetching consistency, DTO patterns, pagination |

  ## Cross-Platform
  | Document | Focus |
  |----------|-------|
  | [Mobile↔Backend Integration](./shared/mobile-backend-crossref.md) | API contract mismatches, event handling |
  | [Dashboard↔Backend Integration](./shared/dashboard-backend-crossref.md) | Admin API contracts, pagination formats |
  | [Auth Flow Comparison](./shared/auth-flow-comparison.md) | Token handling, refresh logic, logout cleanup |
  | [Auth & WebSocket](./shared/auth-websocket.md) | WS auth, token refresh race, session persistence |
  | [Data Fetching Patterns](./shared/data-fetching.md) | Cache invalidation, retry, optimistic updates |
  | [Shared Components](./shared/components.md) | Accessibility, RTL, generic typing, theme |
  | [Prioritized Roadmap](../ROADMAP.md) | All findings sorted by severity |
  ```

**Checkpoint**: `docs/` directory exists with subdirectories and README.md

---

## Phase 2: Backend Code Review (US1 - P1)
**Goal**: Review all 8 backend microservices + 7 shared packages + database schemas for bugs, security issues, performance bottlenecks, edge cases, and architectural concerns.
**Independent Test**: Open each review document and verify: (1) every source file is listed in "Files Covered" table, (2) every finding has severity + category + file path + recommendation, (3) finding IDs use correct prefix.

---

- [x] T003 [P] [US1] Review the API Gateway service. Read all files in `backend/apps/elysia/api-gateway/src/` (index.ts, all files in modules/, all files in shared/). Write review to `D:\Work\ain-rider\docs\backend\api-gateway.md`. Use finding prefix `BGW`. Focus on: JWT verification, rate limiting, proxy error handling, cookie security, mobile token handling, admin route internal JWT, missing body validation, hardcoded values.

- [x] T004 [P] [US1] Review the Auth service. Read all files in `backend/apps/nest/auth-service/src/` (main.ts, app.module.ts, auth/, driver-onboarding/, rider-profile/, storage/, shared/, events/). Read `backend/apps/nest/auth-service/prisma/schema.prisma`. Write review to `D:\Work\ain-rider\docs\backend\auth-service.md`. Use finding prefix `AUTH`. Focus on: password hashing, JWT secrets, refresh token rotation, OTP verification, onboarding state machine, document upload security, race conditions in registration.

- [x] T005 [P] [US1] Review the Trip service. Read all files in `backend/apps/nest/trip-service/src/` (main.ts, app.module.ts, trips/, trip-commands/, consumers/, shared/, events/). Read `backend/apps/nest/trip-service/prisma/schema.prisma`. Write review to `D:\Work\ain-rider\docs\backend\trip-service.md`. Use finding prefix `TRIP`. Focus on: trip state machine, fare calculation, cancellation, rating, NATS event publishing, denormalized driver info.
- [x] T006 [P] [US1] Review the Payment service. Read all files in `backend/apps/nest/payment-service/src/` (main.ts, app.module.ts, payments/, consumers/, shared/, events/). Read `backend/apps/nest/payment-service/prisma/schema.prisma`. Write review to `D:\Work\ain-rider\docs\backend\payment-service.md`. Use finding prefix `PAY`. Focus on: double-charge prevention, cash collection, refunds, currency handling, payment-trip linkage.
- [x] T007 [P] [US1] Review the Admin service. Read all files in `backend/apps/nest/admin-service/src/` (main.ts, app.module.ts, users/, trips/, vehicles/, wallets/, promos/, notifications/, complaints/, settings/, profile/, shared/, events/, consumers/). Read `backend/apps/nest/admin-service/prisma/schema.prisma`. Write review to `D:\Work\ain-rider\docs\backend\admin-service.md`. Use finding prefix `ADM`. Focus on: UserShadow sync, wallet operations, audit log, RBAC enforcement, promo validation.
- [x] T008 [P] [US1] Review the Location service. Read all files in `backend/apps/elysia/location-service/src/` (index.ts, modules/, shared/, events/). Write review to `D:\Work\ain-rider\docs\backend\location-service.md`. Use finding prefix `LOC`. Focus on: H3 indexing, Redis TTL, TimescaleDB writes, nearby driver query, stale location, authentication.
- [x] T009 [P] [US1] Review the Match service. Read all files in `backend/apps/elysia/match-service/src/` (index.ts, modules/, shared/). Write review to `D:\Work\ain-rider\docs\backend\match-service.md`. Use finding prefix `MAT`. Focus on: race conditions, Redis cleanup, driver exclusion, timeout handling, idempotency, memory leaks.
- [x] T010 [P] [US1] Review the WebSocket server. Read all files in `backend/apps/elysia/websocket-server/src/` (index.ts, modules/, shared/, events/). Write review to `D:\Work\ain-rider\docs\backend\websocket-server.md`. Use finding prefix `WS`. Focus on: connection auth, subscription authorization, connection cleanup, NATS error handling, heartbeat, message delivery.
- [x] T011 [P] [US1] Review all 7 shared packages. Read all files in `backend/packages/shared-types/src/`, `backend/packages/nats-client/src/`, `backend/packages/redis-client/src/`, `backend/packages/error-handling/src/`, `backend/packages/internal-api/src/`, `backend/packages/minio-client/src/`, `backend/packages/metrics/src/` and their package.json files. Write review to `D:\Work\ain-rider\docs\backend\shared-packages.md`. Use finding prefix `PKG`. Focus on: type consistency, error handling completeness, missing exports, idempotency, DLQ, logger config, package versions.
- [x] T012 [P] [US1] Review all Prisma schemas. Read `backend/apps/nest/auth-service/prisma/schema.prisma`, `backend/apps/nest/trip-service/prisma/schema.prisma`, `backend/apps/nest/payment-service/prisma/schema.prisma`, `backend/apps/nest/admin-service/prisma/schema.prisma`, and any location-service Prisma schema. Write review to `D:\Work\ain-rider\docs\backend\prisma-schemas.md`. Use finding prefix `AUTH-DB` (auth schema), `TRIP-DB` (trip schema), `PAY-DB` (payment schema), `ADMIN-DB` (admin schema), `SCHEMA-CROSS` (cross-schema). Focus on: missing indexes, unique constraints, cascade deletes, enum consistency, nullable fields, defaults, foreign keys, audit columns.

**Checkpoint**: All 10 backend review documents exist in `docs/backend/`. Each lists every source file covered and contains findings with correct ID prefixes.

---

## Phase 3: Mobile Code Review (US2 - P1)
**Goal**: Review all mobile app screens, state management, API integration, hooks, services, and navigation/auth flow.
**Independent Test**: Open each review document and verify all screens/hooks/stores/services are covered with findings using correct prefixes.
**Edge Case Coverage**: For each domain below, explicitly check for: (1) unexpected backend error codes the mobile app doesn't handle, (2) WebSocket drop mid-trip state reconciliation, (3) driver going offline during active match, (4) stale/missing location data handling.

---

- [x] T013 [P] [US2] Review all mobile screens. Read all files in `mobile/app/(auth)/`, `mobile/app/(rider)/`, `mobile/app/(driver)/`, `mobile/app/support/`. Write review to `D:\Work\ain-rider\docs\mobile\screens.md`. Use finding prefix `MOB-S`. Focus on: missing error boundaries, loading states, empty states, navigation edge cases, form validation, memory leaks, Arabic/RTL layout.
- [x] T014 [P] [US2] Review all Zustand stores. Read `mobile/stores/auth.store.ts`, `mobile/stores/onboarding.store.ts`, `mobile/stores/trip.store.ts`, `mobile/stores/location.store.ts`, `mobile/stores/driver.store.ts`. Write review to `D:\Work\ain-rider\docs\mobile\stores.md`. Use finding prefix `MOB-ST`. Focus on: state consistency, reset/cleanup, race conditions, derived state, store dependencies, type safety.
- [x] T015 [P] [US2] Review the HTTP client and all API modules. Read `mobile/lib/api/client.ts`, `mobile/lib/api/types.ts`, `mobile/lib/api/auth.ts`, `mobile/lib/api/driver.ts`, `mobile/lib/api/trip.api.ts`, `mobile/lib/api/match.api.ts`, `mobile/lib/api/location.api.ts`, `mobile/lib/api/support.api.ts`, `mobile/lib/api/settings.api.ts`, `mobile/lib/storage/secure.ts`. Write review to `D:\Work\ain-rider\docs\mobile\api.md`. Use finding prefix `MOB-API`. Focus on: token refresh, error handling, type safety, retry logic, file upload, request cancellation.
- [x] T016 [P] [US2] Review all hooks and services. Read `mobile/hooks/useAuthCheck.ts`, `mobile/hooks/useLocation.ts`, `mobile/hooks/useNearbyDrivers.ts`, `mobile/hooks/useTrip.ts`, `mobile/hooks/useWebSocket.ts`, `mobile/services/websocket.service.ts`, `mobile/services/location.service.ts`, `mobile/services/background-tasks.ts`, `mobile/services/map/` (all files), `mobile/components/map/` (all files). Write review to `D:\Work\ain-rider\docs\mobile\hooks-services.md`. Use finding prefix `MOB-HK`. Focus on: hook cleanup, WebSocket reconnect, background location, map rendering, OSRM fallback, useTrip state machine, memory leaks.
- [x] T017 [P] [US2] Review navigation and auth flow. Read `mobile/app/_layout.tsx`, `mobile/app/(auth)/_layout.tsx`, `mobile/app/(rider)/_layout.tsx`, `mobile/app/(rider)/(tabs)/_layout.tsx`, `mobile/app/(driver)/_layout.tsx`, `mobile/app/(driver)/(tabs)/_layout.tsx`, `mobile/app/index.tsx`, `mobile/app/offline.tsx`, `mobile/types/user.types.ts`. Write review to `D:\Work\ain-rider\docs\mobile\navigation.md`. Use finding prefix `MOB-NA`. Focus on: auth guard correctness, role-based routing, onboarding redirect, deep linking security, offline screen, notification handling.

**Checkpoint**: All 5 mobile review documents exist in `docs/mobile/`. Each lists every source file covered and contains findings with correct ID prefixes.

---

## Phase 4: Dashboard Code Review (US3 - P2)
**Goal**: Review all dashboard pages, components, data fetching patterns, and auth/WebSocket integration.
**Independent Test**: Open each review document and verify all 11 pages, shared components, hooks, and service modules are covered.
**Edge Case Coverage**: For each domain below, explicitly check for: (1) concurrent admin action handling (e.g., approving a document while user uploads new one), (2) payment confirmation timeout handling, (3) unexpected backend error codes the dashboard doesn't handle.

---

- [x] T018 [P] [US3] Review all dashboard pages. Read all files in `dashboard/src/pages/login/`, `dashboard/src/pages/dashboard/`, `dashboard/src/pages/users/` (including components/, hooks/, services/), `dashboard/src/pages/trips/` (including components/, hooks/, services/), `dashboard/src/pages/complaints/` (including components/, hooks/, services/), `dashboard/src/pages/promos/` (including components/, hooks/, services/), `dashboard/src/pages/vehicles/` (including components/, hooks/, services/), `dashboard/src/pages/wallets/` (including components/, hooks/, services/), `dashboard/src/pages/notifications/` (including components/, services/), `dashboard/src/pages/profile/` (including services/), `dashboard/src/pages/settings/` (including tabs/, hooks/, services/). Write review to `D:\Work\ain-rider\docs\dashboard\pages.md`. Use finding prefix `DASH-P`. Focus on: DTO-transformer pattern consistency, query keys, loading/error/empty states, pagination, nuqs filters, modal state, Arabic text, RTL.
- [x] T019 [P] [US3] Review all shared/layout/UI components. Read all files in `dashboard/src/components/ui/` (all 20+ files), `dashboard/src/components/shared/` (DataTable, Pagination, StatusBadge, PageHeader, StatCard, SearchInput, ConfirmDialog, TableSkeleton, ErrorState, EmptyState, ThemeToggle, ProtectedRoute, GuestRoute), `dashboard/src/components/layout/` (AppLayout, ProtectedAppLayout, Sidebar, Topbar, NotificationBell), `mobile/components/map/` (LocationMarker, DriverMarker, PickupDropoffPins, RoutePolyline, MapView). Write review to `D:\Work\ain-rider\docs\shared\components.md`. Use finding prefix `COMP`. Focus on: generic component typing, accessibility, RTL support, theme toggle, ProtectedRoute edge cases, NotificationBell real-time, StatusBadge completeness.
- [x] T020 [P] [US3] Review data fetching patterns. Read `dashboard/src/api/client.ts`, all `services/api.ts`, `services/dto.ts`, `services/transformers.ts`, `services/queries.ts`, `services/mutations.ts` files across all page domains. Read `dashboard/src/stores/authStore.ts`, `dashboard/src/stores/notificationStore.ts`, `dashboard/src/hooks/useWebSocket.ts`, `dashboard/src/hooks/useTripUpdates.ts`, `dashboard/src/hooks/useTheme.ts`, `dashboard/src/hooks/useTokenRefresh.ts`, `dashboard/src/lib/utils.ts`, `dashboard/src/types/index.ts`, `dashboard/src/router/index.tsx`, `mobile/lib/api/client.ts`, `mobile/stores/` (all stores). Write review to `D:\Work\ain-rider\docs\shared\data-fetching.md`. Use finding prefix `DATA`. Focus on: Axios interceptor token refresh, query invalidation, DTO transformers, error propagation, optimistic updates, token refresh timing, mobile retry/dedup/cancellation patterns.
- [x] T021 [P] [US3] Review auth and WebSocket integration across all platforms. Read `dashboard/src/api/client.ts` (auth interceptors), `dashboard/src/stores/authStore.ts`, `dashboard/src/hooks/useTokenRefresh.ts`, `dashboard/src/hooks/useWebSocket.ts`, `dashboard/src/hooks/useTripUpdates.ts`, `dashboard/src/components/shared/ProtectedRoute.tsx`, `dashboard/src/components/shared/GuestRoute.tsx`, `dashboard/src/components/layout/NotificationBell.tsx`, `dashboard/src/pages/login/services/` (all files), `mobile/lib/api/client.ts`, `mobile/lib/storage/secure.ts`, `mobile/hooks/useWebSocket.ts`, `mobile/hooks/useAuthCheck.ts`, `mobile/services/websocket.service.ts`, `backend/apps/elysia/websocket-server/src/` (all files). Write review to `D:\Work\ain-rider\docs\shared\auth-websocket.md`. Use finding prefix `AUTH-WS`. Focus on: login flow errors, session persistence, cookie handling, WebSocket auth, token refresh race conditions, logout cleanup, mobile vs dashboard differences.

**Checkpoint**: All dashboard and cross-platform review documents exist: `docs/dashboard/pages.md`, `docs/shared/components.md`, `docs/shared/data-fetching.md`, `docs/shared/auth-websocket.md`. Each lists every source file covered and contains findings with correct ID prefixes.

---

## Phase 5: Cross-Platform Integration Review (US4 - P1)
**Goal**: Trace every API endpoint consumed by mobile and dashboard against backend implementation. Verify WebSocket event handling consistency. Verify auth flow consistency.
**Independent Test**: For every mobile API call and dashboard API call, confirm the backend gateway route + downstream controller + response shape matches.
**CRITICAL**: These tasks depend on ALL Phase 2, 3, and 4 tasks being complete.

---

- [x] T022 [US4] Cross-reference all mobile API calls against backend. For EACH function in `mobile/lib/api/auth.ts`, `mobile/lib/api/driver.ts`, `mobile/lib/api/trip.api.ts`, `mobile/lib/api/match.api.ts`, `mobile/lib/api/location.api.ts`, `mobile/lib/api/support.api.ts`, `mobile/lib/api/settings.api.ts`: (1) note HTTP method + path, (2) read gateway route handler in `backend/apps/elysia/api-gateway/src/modules/`, (3) read downstream controller, (4) compare request body shapes, response shapes, and error codes. Also compare: WebSocket events published by backend vs events handled in `mobile/hooks/useWebSocket.ts` and `mobile/hooks/useTrip.ts`; trip state machine values in backend vs `mobile/stores/trip.store.ts` phases; match-service response protocol vs `mobile/lib/api/match.api.ts`. Write review to `D:\Work\ain-rider\docs\shared\mobile-backend-crossref.md`. Use finding prefix `MOB-BE`.
- [x] T023 [US4] Cross-reference all dashboard API calls against backend. For EACH function in all `dashboard/src/pages/*/services/api.ts` files: (1) note HTTP method + path (all prefixed with `/admin/`), (2) read gateway admin route handler in `backend/apps/elysia/api-gateway/src/modules/admin/`, (3) read admin-service controller, (4) compare dashboard DTO shapes vs backend response shapes, (5) compare dashboard transformer assumptions vs actual response fields, (6) compare pagination parameters. Also compare: WebSocket events dashboard subscribes to vs backend publishes; notification types handled by NotificationBell; admin auth pattern. Write review to `D:\Work\ain-rider\docs\shared\dashboard-backend-crossref.md`. Use finding prefix `DASH-BE`.
- [x] T024 [US4] Compare auth flows across all three platforms. Read: Mobile flow (`mobile/lib/api/auth.ts`, `mobile/lib/api/client.ts`, `mobile/lib/storage/secure.ts`, `mobile/hooks/useAuthCheck.ts`, `mobile/app/_layout.tsx`), Dashboard flow (`dashboard/src/pages/login/services/api.ts`, `dashboard/src/api/client.ts`, `dashboard/src/stores/authStore.ts`, `dashboard/src/hooks/useTokenRefresh.ts`, `dashboard/src/components/shared/ProtectedRoute.tsx`), Backend handling (`backend/apps/elysia/api-gateway/src/modules/auth/`, `backend/apps/nest/auth-service/src/auth/`). Compare: login request/response across mobile vs dashboard vs backend; token refresh logic across all three; 401 error handling; logout cleanup; session expiry detection. Write review to `D:\Work\ain-rider\docs\shared\auth-flow-comparison.md`. Use finding prefix `AUTH-COMPARE`.

**Checkpoint**: All 3 integration review documents exist in `docs/shared/` (`mobile-backend-crossref.md`, `dashboard-backend-crossref.md`, `auth-flow-comparison.md`). Every API endpoint consumed by mobile and dashboard has been traced through the backend.

---

## Phase 6: Prioritized Roadmap (US5 - P2)
**Goal**: Consolidate all findings from all review documents into a single prioritized roadmap sorted by severity.
**Depends on**: ALL previous tasks (Phase 2-5) must be complete.

---

- [x] T025 [US5] Read ALL review documents in `docs/backend/` (10 files), `docs/mobile/` (5 files), `docs/dashboard/` (1 file), `docs/shared/` (6 files). Extract every finding. Sort by severity: Critical first, then High, then Medium, then Low. Within each severity, sort cross-cutting first, then backend, then mobile, then dashboard. Write `D:\Work\ain-rider\docs\ROADMAP.md` using the roadmap format from `specs/001-codebase-review/contracts/review-document-format.md`. Include total counts, severity breakdown, and verify every finding from every document appears exactly once.

---

## Phase 7: Validation
**Purpose**: Final quality check across all review documents.

- [x] T026 Validate all review documents. For each file in `docs/backend/`, `docs/mobile/`, `docs/dashboard/`, `docs/shared/`: verify (1) every "Files Covered" table entry references a real file path, (2) every finding has severity badge, category, file path, and recommendation, (3) finding IDs are unique across all documents, (4) roadmap references every finding. Fix any issues found.

  **Edge Case Validation Checklist** (from spec.md):
  - [x] Unexpected error code handling documented in mobile/dashboard reviews
  - [x] WebSocket drop mid-trip recovery documented in auth-websocket reviews
  - [x] Driver offline during match documented in match-service and mobile reviews
  - [x] Concurrent admin action handling documented in admin-service review
  - [x] Stale/missing location handling documented in location-service and mobile reviews
  - [x] Payment timeout handling documented in payment-service review

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Backend)**: Depends on Phase 1 — all 10 tasks can run in parallel
- **Phase 3 (Mobile)**: Depends on Phase 1 — all 5 tasks can run in parallel
- **Phase 4 (Dashboard)**: Depends on Phase 1— all 4 tasks can run in parallel
- **Phase 2+3+4**: Can all run in parallel with each other
- **Phase 5 (Integration)**: Depends on ALL of Phase 2, 3, and 4 being complete
- **Phase 6 (Roadmap)**: Depends on ALL of Phase 2, 3, 4, and 5 being complete
- **Phase 7 (Validation)**: Depends on Phase 6 being complete

### Parallel Opportunities
Maximum parallelism after Phase 1: 19 tasks simultaneously (10 backend + 5 mobile + 4 dashboard)

### Implementation Strategy (Single LLM)
1. T001 + T002 (setup)
2. T003-T012 (backend reviews, one at a time)
3. T013-T017 (mobile reviews)
4. T018-T021 (dashboard reviews)
5. T022-T024 (integration reviews)
6. T025 (roadmap)
7. T026 (validation)
