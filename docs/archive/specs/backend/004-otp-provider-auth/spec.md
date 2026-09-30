# Feature Specification: OTP Provider Authentication (Firebase Phone Auth)

**Feature Branch**: `004-otp-provider-auth`  
**Created**: 2026-03-27  
**Status**: Complete  
**Input**: Implement OTP authentication with provider abstraction

## Clarifications

### Session 2026-03-27

- Q: After a phone number is verified via OTP, what should happen next? → A: Return verification result only; downstream services handle user creation
- Q: Should /auth/verify-otp have rate limiting? → A: Hybrid - IP limit (10/min) + phone limit (5/hour)
- Q: What happens when OTP provider is unavailable? → A: Return 503 Service Unavailable, log error, alert ops
- Q: Current OTP provider implementation? → A: Simulated (console/log-based) for now; Firebase for production later
- Q: Should Firebase ID tokens be single-use? → A: Allow replay until Firebase expiry (~1hr); rate limiting + Firebase revocation sufficient

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

- **FR-001**: System MUST verify OTP tokens via configurable provider (console for dev, Firebase for prod)
- **FR-002**: System MUST extract phone_number and uid from verified token
- **FR-003**: System MUST publish `otp_verified` NATS event on successful verification
- **FR-004**: System MUST return 401 for invalid/expired tokens
- **FR-005**: Firebase Admin SDK MUST be initialized from environment variables
- **FR-006**: verify-otp endpoint MUST return verification result only; user creation is handled by downstream services reacting to the `otp_verified` event
- **FR-007**: verify-otp endpoint MUST enforce rate limiting: 10 requests/minute per IP, 5 requests/hour per phone number
- **FR-008**: ID tokens MAY be reused within Firebase's validity window (~1hr); no server-side single-use tracking required

### Key Entities

- **OtpVerifiedEvent**: Contains phoneNumber, uid, verifiedAt - published to NATS

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `/auth/verify-otp` endpoint responds within 500ms
- **SC-002**: NATS event published within 100ms of verification
- **SC-003**: Invalid tokens rejected with appropriate error message
- **SC-004**: Rate-limited requests return 429 with Retry-After header

## Edge Cases

- Rate limit exceeded: Return HTTP 429 with `Retry-After` header
- OTP provider unavailable: Return 503 Service Unavailable, log error, alert ops team
- Token missing phone_number claim: Return 400 Bad Request

## Assumptions

- Firebase Phone Auth handles OTP sending and client-side verification (production)
- Client app uses Firebase SDK to obtain ID token before calling server (production)
- Firebase credentials provided via environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
- Development uses simulated OTP provider (console-based) via `OTP_PROVIDER=console`

## Implementation Notes

- Provider abstraction allows swapping between console (dev) and Firebase (prod)
- Switch provider via `OTP_PROVIDER` environment variable (`console` | `firebase`)
- Firebase Service Account JSON should NEVER be committed (use env vars)
- Environment variables for Firebase:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (with `\n` for newlines)
