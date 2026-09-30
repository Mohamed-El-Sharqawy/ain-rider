# Feature Specification: Onboarding Auth Check

**Feature Branch**: `001-onboarding-auth-check`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "create the onboarding page that checks if the user is authenticated or not and if yes redirect to home page if not redirect to login page."

## Clarifications

### Session 2026-03-26

- Q: If the user launches the app offline with an expired access token but a valid refresh token, what should the app do? → A: Show a dedicated "No Internet Connection" blocking screen with a "Retry" button.
- Q: How should the app determine the user's role during this initial startup check? → A: Decode from JWT payload on launch, and persist the role in MMKV during login as a fallback.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Launch Authentication Check (Priority: P1)

When a user opens the application, the system should seamlessly verify their authentication status behind the scenes and route them to the appropriate screen (Home or Login) without requiring manual interaction if they are already logged in.

**Why this priority**: It is the default entry point of the app and handles security, preventing unauthenticated access to the main screens while saving logged-in users from having to sign in repeatedly.

**Independent Test**: Can be fully tested by launching the app in two distinct states: (1) with a valid token stored and (2) with no token stored, verifying the final destination in both cases.

**Acceptance Scenarios**:

1. **Given** the user has a valid access/refresh token stored on the device, **When** they launch the app, **Then** they are automatically redirected to the Home page relevant to their role (Rider or Driver).
2. **Given** the user has no tokens stored or the tokens are expired and unrefreshable, **When** they launch the app, **Then** they are automatically redirected to the Login page.
3. **Given** the user is launching the app and verifying tokens, **When** the network call is being made or storage is being accessed, **Then** a splash screen or loading indicator is shown to prevent flickering.

---

### Edge Cases

- What happens when the user has an expired access token but a valid refresh token? (Should attempt to refresh behind the scenes before redirecting).
- What happens when there is no internet connection during the authentication check? If tokens exist and are within their 15-min expiry, the app proceeds offline. If the access token is expired and unreachable for refresh, the app displays a dedicated "No Internet Connection" blocking screen with a "Retry" button rather than redirecting to Login.
- How does the system handle corrupted or invalid tokens in secure storage? (Should clear the storage and redirect to Login).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST check secure storage for an existing `accessToken` and `refreshToken` upon application launch.
- **FR-002**: System MUST validate the structural validity and expiry of the stored tokens (client-side decoding without signature verification).
- **FR-003**: System MUST automatically attempt to refresh the `accessToken` using the `refreshToken` if the initial token is expired.
- **FR-004**: System MUST redirect the user to the appropriate role-based Home screen (Rider or Driver) by decoding the role from the `accessToken` JWT payload, utilizing a cached role in MMKV as a fallback.
- **FR-005**: System MUST redirect the user to the Auth block (Login screen) if no valid tokens are present or refresh fails.
- **FR-006**: System MUST clear invalid or unrefreshable tokens from secure storage to prevent infinite auth loops.

### Key Entities

- **Auth Token Pair**: Access and Refresh JSON Web Tokens stored securely on the mobile device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated users are correctly routed to the Login screen.
- **SC-002**: Over 99% of users with valid stored sessions bypass the login screen and land directly on the Home screen.
- **SC-003**: The app displays exactly zero blank screens or UI flickering during the auth resolution process.

## Assumptions

- Users have basic internet connectivity or valid local tokens to initialize the app successfully.
- The `accessToken` and `refreshToken` are available directly in the response body rather than solely via `httpOnly` cookies, as per recent backend updates for mobile clients.
