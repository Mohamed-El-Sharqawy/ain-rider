# Feature Specification: Mobile OTP Architecture

**Feature Branch**: `002-mobile-otp-architecture`  
**Created**: 2026-03-27  
**Status**: Draft  

## Clarifications

### Session 2026-03-27
- Q: What is the specific timeout duration before the user can press 'Resend Code'? → A: 60 seconds
- Q: How should the mobile application handle a "Too Many Requests" error from the backend? → A: Show the specific wait time provided by the backend and disable the request button for that duration.
- Q: How should the resulting authentication token be securely stored on the device post-verification? → A: Store in platform-native secure storage, aligning with the pattern established in the Onboarding Auth Check specification.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Requesting Verification Code (Priority: P1)

As a mobile application user, I want to securely request a verification code sent to my phone number so that I can authenticate my identity without remembering a password.

**Why this priority**: Requesting a code is the mandatory first step before verification can occur and is a blocking requirement for the onboarding flow.

**Independent Test**: Can be tested by entering a valid phone number, pressing submit, and observing that the system transitions to a waiting/code-entry state while confirming dispatch.

**Acceptance Scenarios**:

1. **Given** the user is on the phone verification screen, **When** they submit a correctly formatted phone number, **Then** the application confirms the request was sent and transitions to the code entry UI.
2. **Given** the user is requesting a code, **When** the backend service is currently unreachable, **Then** the application displays a user-friendly error message allowing them to retry the request.

---

### User Story 2 - Verifying the Code (Priority: P1)

As a mobile application user, I want to submit the verification code I received so that my device is authenticated and I can proceed with using the application.

**Why this priority**: Verification is required to actually prove identity and gain access to the application's authenticated features.

**Independent Test**: Can be tested by entering a valid phone number, receiving the system-generated code, and successfully submitting it to gain access to the next screen.

**Acceptance Scenarios**:

1. **Given** the user has received their temporary verification code, **When** they submit the correct 6-digit code, **Then** the application verifies their identity and proceeds to the next stage in their journey.
2. **Given** the user has received a temporary code, **When** they submit an incorrect code, **Then** the application displays an error message keeping them on the verification screen to try again.
3. **Given** the user is waiting to receive a code, **When** they press the resend button after the 60-second timeout period, **Then** a new code request is dispatched securely.

### Edge Cases & Explicit UX Constraints

**FR-006 (Input Validation)**: The mobile application MUST dynamically disable the request button if the phone number length, format, or country code is invalid. Obvious errors must be caught strictly client-side via real-time format blocking.
**FR-007 (Expired Code)**: If the user inputs an expired code, the UI MUST display "This code has expired. Please request a new one." The system MUST NOT auto-resend. Instead, the UI MUST visually highlight the Resend button so the user initiates the request consciously.
**FR-008 (Network Loss)**: If network connectivity is lost during an API request, the system MUST halt the loading spinner immediately and display: "No internet connection. Please check your network and try again." Verification inputs (the typed 6 digits) MUST NOT be cleared, allowing the user to simply press Verify again upon reconnection mapping.
**FR-009 (Session Expiration during Backgrounding)**: When the user backgrounds the application and returns after the 5-minute backend window, the system MUST keep them pinned on the `otp-verify` screen format (dropping to the start screen is forbidden). The UI MUST surface a banner reading "Your code has expired." and visually prompt the Resend action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to input their phone number and request a verification code.
- **FR-002**: The system MUST allow users to input a received 6-digit code to complete the verification process.
- **FR-003**: The mobile client MUST NOT integrate or bundle any third-party SMS provider SDKs (e.g., Firebase Auth, Twilio) for phone verification.
- **FR-004**: The mobile client MUST exclusively communicate with the application's abstract backend endpoints for all OTP operations (requesting and verifying).
- **FR-005**: The system MUST provide clear, actionable error guidance when verification fails due to expiration, mismatch, or network issues.

### Key Entities

- **Phone Verification Result**: The outcome of the verification attempt, containing the success status and the authentication token pair if successful, which MUST be immediately saved to native secure storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully request and verify an OTP in under 30 seconds under normal network conditions.
- **SC-002**: The compiled mobile application contains 0 dependencies on external third-party authentication/SMS SDKs.
- **SC-003**: 95% of users successfully pass the OTP verification step on their first attempt without requiring a resend.
- **SC-004**: The application payload size is kept minimal by omitting unnecessary third-party authentication SDKs.

## Assumptions

- Users have sufficient cellular or internet connectivity to receive SMS messages and communicate with the system's backend.
- The mobile application relies safely on the abstract backend to enforce security rules, rate limit restrictions, and time-to-live (TTL) logic.
- Basic local validation (e.g., ensuring 6 digits are typed) is handled by the mobile UI to minimize unnecessary backend requests.
