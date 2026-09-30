# Quickstart: Mobile OTP Architecture

## Prerequisites
- A running instance of the `auth-service` backend with the `/auth/request-otp` and `/auth/verify-otp` endpoints reachable.
- Appropriate backend provider configured (e.g., `OTP_PROVIDER=console` for local development).

## Getting Started

1. **Environment Setup**: Ensure your `.env` contains the API base URL.
2. **Launch Application**: Execute `npm run ios` or `npm run android`.
3. **Navigation**: Upon launch, the core Onboarding Auth Check will verify your stored tokens. If none exist, you will be directed to the authentication flow.
4. **Initiate Request**: Enter a valid phone number and submit to trigger the OTP network request.
5. **Retrieve Code**: Check your SMS inbox (or the backend console logs if running in dev mode).
6. **Complete Verification**: Enter the 6-digit code. Upon success, the system will save the newly received `accessToken` and `refreshToken` into the device's secure storage and seamlessly transition to the Home screen.
