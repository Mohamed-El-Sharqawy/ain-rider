# Tasks: Mobile OTP Architecture

**Input**: Design documents from `/specs/002-mobile-otp-architecture/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create auth and utility directories: `app/(auth)/`, `lib/api/`, and `lib/storage/`
- [x] T002 Update `app/(auth)/_layout.tsx` to handle authentication sub-routing (if not existing)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement `expo-secure-store` wrapper for reading and writing JWTs in `lib/storage/secure.ts`
- [x] T004 [P] Implement base fetch API client in `lib/api/client.ts` to attach base URL and parse generic JSON responses
- [x] T005 Define OTP interfaces (`OtpRequestPayload`, `OtpVerifyPayload`, `PhoneVerificationResult`) in `lib/api/types.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Requesting Verification Code (Priority: P1)

**Goal**: Allow users to securely request a verification code sent to their phone number.

**Independent Test**: Test by entering a valid phone number, pressing submit, and observing the network request to `/auth/request-otp` and subsequent UI transition.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Implement `requestOtp(phone: string)` API call in `lib/api/auth.ts` using `lib/api/client.ts`
- [ ] T007 [US1] Modify OTP Request UI screen in `app/(auth)/phone.tsx` with a phone number input and submit button
- [ ] T008 [US1] Connect `app/(auth)/phone.tsx` to `requestOtp` API local state (Idle, Requesting, Success, Error)
- [ ] T009 [US1] Add rate limit error handling to `app/(auth)/phone.tsx` UI to display wait time if backend gives 429 Too Many Requests
- [ ] T010 [US1] On successful API response in `app/(auth)/phone.tsx`, route to the OTP Verify screen passing the phone string parameter

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Verifying the Code (Priority: P1)

**Goal**: Allow users to submit the verification code to authenticate their device.

**Independent Test**: Test by entering the received 6-digit code, verifying it against `/auth/verify-otp`, and confirming it securely stores tokens and routes to Home.

### Implementation for User Story 2

- [ ] T011 [P] [US2] Implement `verifyOtp(phone: string, code: string)` API call in `lib/api/auth.ts` (returns `PhoneVerificationResult`)
- [ ] T012 [US2] Modify OTP Verify UI screen in `app/(auth)/verify-otp.tsx` with a 6-digit code input and verify button
- [ ] T013 [US2] Connect `app/(auth)/verify-otp.tsx` to `verifyOtp` API local state (WaitingForCode, Verifying, Success, Error)
- [ ] T014 [US2] Implement the 60-second Resend Timer UI in `app/(auth)/verify-otp.tsx` and wire the resend button to trigger `requestOtp` again
- [ ] T015 [US2] Ensure `app/(auth)/verify-otp.tsx` saves `accessToken` and `refreshToken` via `lib/storage/secure.ts` on success, then redirects fully out of auth stack

**Checkpoint**: User Story 2 should be fully functional

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T016 [P] Prevent users from navigating back to OTP screens using hardware back button once logged in
- [ ] T017 Add visual loading spinners and disable buttons during active network requests in both UI screens
- [ ] T018 Validate all typescript types ensure no explicit `any` usage exists within `lib/api/auth.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3+)**: Depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all user stories being complete

### Parallel Opportunities

- T003 (Secure Store wrapper) and T004 (API Client) can be implemented completely concurrently since they do not rely on each other.
- T011 (`verifyOtp` API core) can be implemented in parallel with the UX elements of T007 (`otp-request` screen setup).

### Implementation Strategy

1. **Foundation Core**: Build `lib/storage/secure.ts` and `lib/api/auth.ts` entirely.
2. **UI Scaffolding**: Build `app/(auth)/otp-request.tsx` and `app/(auth)/otp-verify.tsx` purely for visual states.
3. **Integration**: Connect UI screens logic to the real API clients and Secure Storage to seal the MVP.
