# Data Model: Mobile OTP Architecture

## Entities

### `PhoneVerificationResult`
Represents the successful outcome of the OTP verification.

**Fields**:
- `success` (boolean): Whether the verification passed.
- `accessToken` (string): The JWT string used for API authorization.
- `refreshToken` (string): The long-lived token used to acquire new access tokens.

**Storage Constraints**:
- Both tokens must be immediately persisted to platform-native secure storage (`expo-secure-store`).

### `OtpRequestPayload`
The data sent to the backend to initiate a verification flow.

**Fields**:
- `phone` (string): The properly formatted phone number (E.164 format recommended).

### `OtpVerifyPayload`
The data sent to the backend to confirm the OTP.

**Fields**:
- `phone` (string): The phone number associated with the request.
- `code` (string): The 6-digit verification code entered by the user.

## Client State Transitions
The verification UI operates on a distinct state machine:
1. **Idle**: User is prompted to enter their phone number.
2. **Requesting**: Network request in flight (OTP request).
3. **WaitingForCode**: User is prompted to enter the OTP. The 60-second resend timer begins.
4. **Verifying**: Network request in flight (OTP verify).
5. **Success**: Secure storage writes complete; redirection to Home screen.
6. **Error**: Displays specific error guidance (e.g., Invalid Code, Backend Rate Limit countdown).
