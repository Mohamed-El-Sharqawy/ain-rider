# Feature Specification: OTP Provider Authentication (Firebase Phone Auth)

**Feature Branch**: `004-otp-provider-auth`  
**Created**: 2026-03-27  
**Status**: Complete  
**Input**: Implement OTP authentication with provider abstraction

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Phone Number Verification (Priority: P1)

A user wants to verify their phone number using OTP to enable phone-based authentication.

**Why this priority**: Phone verification is critical for trust and security in a ride-hailing app.

**Independent Test**: Can be tested by calling `/auth/verify-otp` with a valid Firebase ID token from client-side Phone Auth.

**Acceptance Scenarios**:

1. **Given** a user completes Firebase Phone Auth on client, **When** they send the ID token to `/auth/verify-otp`, **Then** the server verifies the token and returns phone number + uid
2. **Given** an invalid or expired ID token, **When** sent to `/auth/verify-otp`, **Then** returns 401 Unauthorized

---

### User Story 2 - OTP Event Publishing (Priority: P2)

Downstream services need to know when a phone number is verified.

**Why this priority**: Enables other services to react to phone verification (e.g., auto-create user profile).

**Independent Test**: Verify NATS `otp_verified` event is published after successful verification.

**Acceptance Scenarios**:

1. **Given** successful OTP verification, **When** the event is published, **Then** `ain_rider.otp_verified` event contains phoneNumber, uid, verifiedAt

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST verify Firebase Phone Auth ID tokens
- **FR-002**: System MUST extract phone_number and uid from verified token
- **FR-003**: System MUST publish `otp_verified` NATS event on successful verification
- **FR-004**: System MUST return 401 for invalid/expired tokens
- **FR-005**: Firebase Admin SDK MUST be initialized from environment variables

### Key Entities

- **OtpVerifiedEvent**: Contains phoneNumber, uid, verifiedAt - published to NATS

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `/auth/verify-otp` endpoint responds within 500ms
- **SC-002**: NATS event published within 100ms of verification
- **SC-003**: Invalid tokens rejected with appropriate error message

## Assumptions

- Firebase Phone Auth handles OTP sending and client-side verification
- Client app uses Firebase SDK to obtain ID token before calling server
- Firebase credentials provided via environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)

## Implementation Notes

- Uses Firebase Admin SDK directly (no provider abstraction needed)
- Firebase Service Account JSON should NEVER be committed (use env vars)
- Environment variables required:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (with `\n` for newlines)
