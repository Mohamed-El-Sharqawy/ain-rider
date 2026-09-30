# Implementation Plan: Onboarding Auth Check

**Branch**: `001-onboarding-auth-check` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-onboarding-auth-check/spec.md`

## Summary

Implement an initial onboarding layout that serves as the gateway to the application, verifying authentication status natively via `expo-secure-store`. It parses the stored `accessToken` using `jwt-decode` to check validity and extract the user's role, allowing instantaneous and flicker-free redirection to either the User Home, Driver Home, or Auth Login screen. 

## Technical Context

**Language/Version**: TypeScript 5.9 (React Native 0.83)
**Primary Dependencies**: `expo-secure-store`, `jwt-decode`, `expo-router`
**Storage**: `expo-secure-store` (Keychain/EncryptedSharedPreferences), MMKV (fallback cache)
**Target Platform**: iOS/Android Mobile App
**Project Type**: Mobile App Frontend
**Performance Goals**: < 2 seconds app startup routing to the correct screen without UI flicker.

## Constitution Check

*GATE: Passed*
The current template constitution contains placeholder principles. Project structures rely on standardized `expo-router` best practices along with explicit requirement testing (offline states and rapid token parsing). No violations found.

## Project Structure

### Documentation (this feature)

```text
specs/001-onboarding-auth-check/
├── plan.md              # This file
├── research.md          # Technology decisions
├── data-model.md        # Auth schemas / storage keys
├── quickstart.md        # Test guides
└── tasks.md             # Task definitions (future)
```

### Source Code

```text
mobile/
├── app/
│   ├── _layout.tsx      # Root layout executing the auth check
│   ├── index.tsx        # Entry redirect or splash placeholder
│   └── (auth)/
│       └── login.tsx    # Fallback destination
├── src/
│   ├── hooks/
│   │   └── useAuthCheck.ts   # Core logic for token validation
│   └── stores/
│       └── auth.store.ts     # Zustand store for caching role dynamically
```

**Structure Decision**: Adhere to the established Expo Router (`app/`) directory format for views, wrapping the check inside the Global Root Layout to hide behind the Splash Screen. Auxiliary functions reside in `src/hooks` to preserve separation of concerns.

## Complexity Tracking

No constitution violations needing justification. Standard mobile authentication practices are implemented.
