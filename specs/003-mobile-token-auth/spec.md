# Feature Specification: Mobile Token Authentication

**Feature Branch**: `003-mobile-token-auth`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Mobile Token Auth - Enable mobile clients to authenticate using Bearer tokens in response body instead of httpOnly cookies. Add X-Client-Type: mobile header detection. Login/register return accessToken+refreshToken in body for mobile. Refresh and authGuard support Bearer header with cookie fallback."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Mobile User Login (Priority: P1)

A mobile app user wants to log in to their account. Since mobile apps cannot reliably use httpOnly cookies for security, they need to receive authentication tokens directly in the response body.

**Why this priority**: Login is the most critical authentication flow - without it, mobile users cannot access protected features.

**Independent Test**: Can be fully tested by sending a login request with X-Client-Type: mobile header and verifying accessToken and refreshToken are returned in the response body.

**Acceptance Scenarios**:

1. **Given** a registered user with valid credentials, **When** they submit login with X-Client-Type: mobile header, **Then** response body contains success, user, accessToken, and refreshToken
2. **Given** a registered user with valid credentials, **When** they submit login without X-Client-Type header, **Then** cookies are set but no tokens appear in response body (existing web behavior preserved)

---

### User Story 2 - Mobile User Registration (Priority: P1)

A new mobile app user wants to create an account and immediately be authenticated.

**Why this priority**: Registration with immediate authentication is essential for new user onboarding on mobile.

**Independent Test**: Can be fully tested by sending a registration request with X-Client-Type: mobile header and verifying accessToken and refreshToken are returned.

**Acceptance Scenarios**:

1. **Given** a new user with valid registration data, **When** they submit registration with X-Client-Type: mobile header, **Then** response body contains success, user, accessToken, and refreshToken
2. **Given** a new user with valid registration data, **When** they submit registration without X-Client-Type header, **Then** cookies are set but no tokens appear in response body

---

### User Story 3 - Token Refresh (Priority: P1)

A mobile user with an expired access token wants to obtain a new access token using their refresh token.

**Why this priority**: Token refresh is essential for maintaining sessions without requiring re-login.

**Independent Test**: Can be fully tested by sending a refresh request with Bearer token in Authorization header and verifying new accessToken is returned.

**Acceptance Scenarios**:

1. **Given** a valid refresh token in Authorization Bearer header, **When** refresh is requested with X-Client-Type: mobile header, **Then** response body contains success and new accessToken
2. **Given** a valid refresh token in cookies, **When** refresh is requested without Bearer header, **Then** refresh works via cookie fallback (existing web behavior preserved)
3. **Given** both Bearer header and cookie present, **When** refresh is requested, **Then** Bearer header takes precedence

---

### User Story 4 - Authenticated Route Access (Priority: P1)

A mobile user wants to access protected routes using their Bearer token.

**Why this priority**: Accessing protected resources is the core purpose of authentication.

**Independent Test**: Can be fully tested by accessing /auth/me endpoint with Bearer token and verifying user data is returned.

**Acceptance Scenarios**:

1. **Given** a valid access token in Authorization Bearer header, **When** accessing any protected route, **Then** request passes authentication
2. **Given** a valid session cookie without Bearer header, **When** accessing any protected route, **Then** request passes authentication via cookie fallback
3. **Given** an expired Bearer token, **When** accessing a protected route, **Then** response is 401 with TOKEN_EXPIRED error
4. **Given** no Bearer token and no valid cookie, **When** accessing a protected route, **Then** response is 401 with UNAUTHORIZED error

---

### Edge Cases

- What happens when both Bearer header and cookie are present but have different values? Bearer header takes precedence.
- What happens when X-Client-Type header has an unexpected value? Only "mobile" value triggers mobile behavior; other values are treated as web clients.
- What happens when refresh token is expired? Standard expired token error response.
- What happens when a previously-used refresh token is presented again? All tokens for that session are revoked; user must re-login (indicates potential token theft).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST detect mobile client requests via X-Client-Type: mobile header
- **FR-002**: System MUST return accessToken and refreshToken in response body for login requests when mobile header is present
- **FR-003**: System MUST return accessToken and refreshToken in response body for registration requests when mobile header is present
- **FR-004**: System MUST continue setting httpOnly cookies for all authentication responses regardless of client type
- **FR-005**: System MUST accept refresh tokens from Authorization Bearer header as primary method
- **FR-006**: System MUST fall back to cookie-based refresh token when Bearer header is absent
- **FR-007**: System MUST return new accessToken in response body for refresh requests when mobile header is present
- **FR-007a**: System MUST issue a new refresh token and invalidate the previous one on each refresh (refresh token rotation)
- **FR-007b**: System MUST revoke all tokens for the user session when a previously-used refresh token is presented (reuse detection)
- **FR-008**: System MUST authenticate protected routes using Authorization Bearer header as primary method
- **FR-009**: System MUST fall back to cookie-based authentication when Bearer header is absent
- **FR-010**: System MUST return 401 with TOKEN_EXPIRED error code when Bearer token is expired
- **FR-011**: System MUST return 401 with UNAUTHORIZED error code when neither Bearer token nor valid cookie is present

### Key Entities

- **Access Token**: Short-lived credential (15 min lifetime) used to authenticate API requests, passed via Bearer header or cookie
- **Refresh Token**: Long-lived credential (7 day lifetime) used to obtain new access tokens, passed via Bearer header or cookie; rotated on each use (old token invalidated)
- **X-Client-Type Header**: Request header indicating client type ("mobile" for mobile clients)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Mobile users can complete login and receive tokens in under 2 seconds
- **SC-002**: Mobile users can access protected routes with Bearer token with 100% success rate when token is valid
- **SC-003**: Existing web users experience no change in authentication behavior (backward compatibility)
- **SC-004**: Token refresh completes in under 1 second for mobile clients
- **SC-005**: Authentication errors clearly distinguish between expired tokens and missing credentials

## Clarifications

### Session 2026-03-26

- Q: When a mobile client refreshes their access token, should the refresh token itself be rotated? → A: Yes - Issue new refresh token on each refresh, invalidate old one
- Q: When a previously-used (rotated) refresh token is presented again, how should the system respond? → A: Revoke all tokens for that user session (require re-login)
- Q: What should the access token and refresh token lifetimes be? → A: Access: 15 min / Refresh: 7 days

## Assumptions

- Mobile clients will store tokens securely using platform-appropriate secure storage mechanisms
- The existing token generation and validation infrastructure remains unchanged
- The existing cookie-based authentication for web clients continues to work unchanged
