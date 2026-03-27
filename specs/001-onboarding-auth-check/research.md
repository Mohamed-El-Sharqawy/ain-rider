# Phase 0: Research & Technical Decisions - Onboarding Auth Check

## Storage Mechanism
- **Decision**: `expo-secure-store`
- **Rationale**: Mobile applications require tokens to be encrypted at rest. `expo-secure-store` integrates directly with iOS Keychain and Android EncryptedSharedPreferences.
- **Alternatives considered**: `AsyncStorage` (Rejected due to lack of encryption and insecurity for JWTs).

## Token Parsing
- **Decision**: `jwt-decode`
- **Rationale**: A lightweight, standard, dependency-free method to decode the base64url payload of a JWT to check expiration (`exp`) and extract the role (`role`), satisfying FR-002 and FR-004.
- **Alternatives considered**: Manual base64 decoding (Rejected due to edge cases in padding and cross-platform padding compatibility in React Native).

## Navigation Strategy
- **Decision**: Utilize `expo-router` imperative navigation (`router.replace`) combined with a root layout component that mounts a splash screen while the async storage check completes.
- **Rationale**: Meets the criteria for zero UI flickering (SC-003) by holding the splash screen until the auth state is fully resolved.
