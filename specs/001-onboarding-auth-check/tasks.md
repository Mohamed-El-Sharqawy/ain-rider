# Tasks: Onboarding Auth Check

**Input**: Design documents from `/specs/001-onboarding-auth-check/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and base dependencies

- [x] T001 Install `expo-secure-store` and `jwt-decode` dependencies in package.json using package manager (e.g., `npm install`). 

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data structures and state stores

- [x] T002 [P] Create `TokenPayload` typescript interface matching data-model in `src/types/user.types.ts`
- [x] T003 [P] Implement Zustand Auth Store providing `isAuthenticated` and `role` states in `src/stores/auth.store.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - App Launch Authentication Check (Priority: P1) 🎯 MVP

**Goal**: Automatically resolve auth state from secure storage to route the user correctly without flickering.

**Independent Test**: Launch the app with no tokens and verify routing to `/(auth)/login`. Manually set valid tokens in secure storage and verify routing to `/(rider)/home` or `/(driver)/home`. 

### Implementation for User Story 1

- [x] T004 [P] [US1] Create placeholder Login screen exporting a basic React component in `app/(auth)/login.tsx`
- [x] T005 [P] [US1] Create placeholder Rider Home screen exporting a basic React component in `app/(rider)/(tabs)/home.tsx`
- [x] T006 [P] [US1] Create placeholder Driver Home screen exporting a basic React component in `app/(driver)/(tabs)/home.tsx`
- [x] T007 [US1] Implement `useAuthCheck` hook utilizing `expo-secure-store` and `jwt-decode` to read tokens, decode role, and update Zustand store in `src/hooks/useAuthCheck.ts`
- [x] T008 [US1] Implement Root Layout component with `expo-splash-screen` handling routing based on `useAuthCheck` result in `app/_layout.tsx`
- [x] T009 [P] [US1] Create offline fallback screen exporting a basic component in `app/offline.tsx`
- [x] T010 [US1] Update `src/hooks/useAuthCheck.ts` to trigger navigation to `/offline` if tokens are expired and network is unreachable.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect the application

- [x] T011 [P] Run linter and formatter on all modified files
- [x] T012 Run quickstart.md validation to ensure routing behaves as expected on a local simulator.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all user stories completing

### Parallel Opportunities

- Placeholder screens (T004-T006, T009) can be created in parallel.
- Types (T002) and Store setup (T003) can be built concurrently.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready
