# Phase 0: Research & Decisions

## Context
The technical context for the Mobile OTP Architecture relies heavily on the constraints provided by the specification, specifically mandating zero third-party SMS/Auth SDKs on the client. 

## Research Findings

### Decision 1: HTTP Networking Client
- **Decision**: Native `fetch` API.
- **Rationale**: The project's `package.json` does not include `axios` or other heavy HTTP clients. The OTP API requires simple `POST` requests and JSON parsing. Introducing a new dependency just for 2 endpoints violates simplicity principles.
- **Alternatives considered**: `axios` (rejected to keep bundle size minimal and dependencies lean).

### Decision 2: Token Storage Mechanism
- **Decision**: `expo-secure-store`.
- **Rationale**: The project already relies on `expo-secure-store` version `~15.0.8`. The Authentication Check specification dictates that the Auth Token Pair (Access and Refresh tokens) MUST be stored in platform-native secure storage. `expo-secure-store` seamlessly wraps iOS Keychain and Android EncryptedSharedPreferences.
- **Alternatives considered**: `@react-native-async-storage/async-storage` (rejected because the specification mandates native secure storage for encryption).
