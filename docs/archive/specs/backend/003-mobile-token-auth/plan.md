# Implementation Plan: Mobile Token Authentication

**Branch**: `003-mobile-token-auth` | **Date**: 2026-03-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-mobile-token-auth/spec.md`

## Summary

Enable mobile clients to authenticate using Bearer tokens returned in the response body (since mobile cannot use httpOnly cookies). Add X-Client-Type: mobile header detection. Implement refresh token rotation with reuse detection for enhanced security. All changes are additive—no breaking changes to existing web authentication flow.

## Technical Context

**Language/Version**: TypeScript (Bun for Elysia, Node.js 20+ for NestJS)
**Primary Dependencies**: ElysiaJS (api-gateway), NestJS (auth-service), @nestjs/jwt, Prisma
**Storage**: PostgreSQL (ainrider_auth database via PgBouncer :5434)
**Testing**: Bun test (Elysia), Jest (NestJS)
**Target Platform**: Backend services (api-gateway:3000, auth-service:4000)
**Project Type**: Web service (microservices architecture)
**Performance Goals**: <2s login, <1s refresh, 100% backward compatibility with web clients
**Constraints**: No new dependencies, ~35 lines of code, no architecture changes
**Scale/Scope**: All mobile riders and drivers

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                    | Status | Notes                                                                                 |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------- |
| I. Gateway-Centricity        | PASS   | All auth routes remain through api-gateway                                            |
| II. Error Transparency       | PASS   | New error codes (TOKEN_EXPIRED, UNAUTHORIZED) logged with context                     |
| III. Unified Response Schema | PASS   | Mobile responses follow `{ success, user, accessToken, refreshToken }` format         |
| IV. Transport-Agnostic Logic | PASS   | auth-service business logic unchanged; only api-gateway handles transport differences |
| V. Race Condition Prevention | PASS   | Token rotation uses atomic database operations                                        |

**Re-check after Phase 1**: Token family tracking in database requires unique constraint on token family.

## Project Structure

### Documentation (this feature)

```text
specs/003-mobile-token-auth/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth-routes.md   # API contract changes
└── checklists/
    └── requirements.md  # Validation checklist
```

### Source Code (repository root)

```text
apps/
├── elysia/
│   └── api-gateway/
│       └── src/
│           └── modules/
│               └── auth/
│                   ├── index.ts      # MODIFIED: login/register/refresh/me routes
│                   ├── guard.ts      # MODIFIED: Bearer header first, cookie fallback
│                   └── service.ts    # UNCHANGED: proxy logic
│
└── nest/
    └── auth-service/
        ├── prisma/
        │   └── schema.prisma         # MODIFIED: add RefreshToken model
        └── src/
            └── auth/
                ├── auth.service.ts   # MODIFIED: token rotation logic
                ├── auth.controller.ts # UNCHANGED
                └── dto/              # UNCHANGED
```

**Structure Decision**: Changes confined to existing auth module in api-gateway and auth-service. No new files or services.

## Complexity Tracking

No constitution violations. All changes are additive.

## Phase 0: Research Summary

### Decision 1: Token Resolution Pattern

**Decision**: Bearer header first, then cookie fallback
**Rationale**: Consistent pattern across refresh and authGuard; allows mobile to use Bearer while web continues using cookies
**Alternatives considered**:

- Cookie only (rejected: mobile cannot use httpOnly)
- Separate endpoints (rejected: increases surface area)

### Decision 2: Mobile Client Detection

**Decision**: X-Client-Type: mobile header (exact match)
**Rationale**: Explicit opt-in, no user-agent sniffing, clear contract
**Alternatives considered**:

- User-agent parsing (rejected: unreliable, complex)
- Separate /mobile/auth routes (rejected: code duplication)

### Decision 3: Refresh Token Storage

**Decision**: Database table with token family tracking
**Rationale**: Enables rotation detection, revocation on reuse, audit trail
**Alternatives considered**:

- Redis only (rejected: no persistence for audit, rotation detection harder)
- JWT only (rejected: cannot revoke individual tokens)

### Decision 4: Response Format

**Decision**: Mobile clients receive `{ success, user, accessToken, refreshToken }` in body
**Rationale**: Mobile clients need tokens to store in secure storage; web clients unchanged
**Alternatives considered**:

- Always return tokens in body (rejected: security risk for web clients)

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for full schema.

**New Entity: RefreshToken**

- `id`: UUID primary key
- `userId`: FK to User
- `tokenHash`: SHA-256 hash of token (not plaintext)
- `family`: UUID for token family (rotation tracking)
- `expiresAt`: Timestamp
- `revoked`: Boolean
- `createdAt`: Timestamp

### API Contracts

See [contracts/auth-routes.md](./contracts/auth-routes.md) for full contract.

**Modified Endpoints:**

| Endpoint            | Mobile Header                 | Response Change                                                                |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| POST /auth/login    | X-Client-Type: mobile         | Returns `{ success, user, accessToken, refreshToken }`                         |
| POST /auth/register | X-Client-Type: mobile         | Returns `{ success, user, accessToken, refreshToken }`                         |
| POST /auth/refresh  | Authorization: Bearer <token> | Accepts Bearer OR cookie; mobile gets `{ success, accessToken, refreshToken }` |
| GET /auth/me        | Authorization: Bearer <token> | Accepts Bearer OR cookie                                                       |

### Implementation Tasks

#### Task 1: Modify auth guard (guard.ts)

- Accept Bearer token from Authorization header as primary
- Fall back to accessToken cookie if no Bearer header
- Return TOKEN_EXPIRED vs UNAUTHORIZED error codes

#### Task 2: Modify login route (index.ts)

- Check X-Client-Type header for "mobile"
- If mobile: return tokens in response body (cookies still set)
- If not mobile: existing behavior (cookies only)

#### Task 3: Modify register route (index.ts)

- Same pattern as login for mobile detection

#### Task 4: Modify refresh route (index.ts)

- Accept token from Authorization Bearer header first
- Fall back to refreshToken cookie
- If mobile header: return `{ success, accessToken, refreshToken }` in body

#### Task 5: Add RefreshToken model (schema.prisma)

- Add RefreshToken table with family tracking
- Add unique constraint on (userId, family)

#### Task 6: Implement token rotation (auth.service.ts)

- On refresh: validate old token, generate new token in same family
- Mark old token as revoked
- On reuse of revoked token: revoke entire family (require re-login)

### Quickstart

See [quickstart.md](./quickstart.md) for testing guide.

### Dependencies

| Dependency               | Type     | Status    |
| ------------------------ | -------- | --------- |
| Existing auth-service    | Internal | Active    |
| PostgreSQL ainrider_auth | Database | Active    |
| @nestjs/jwt              | Package  | Installed |
| bcrypt                   | Package  | Installed |

### Risk Assessment

| Risk                             | Mitigation                                        |
| -------------------------------- | ------------------------------------------------- |
| Token family explosion           | Index on (userId, family), cleanup expired tokens |
| Mobile client sends wrong header | Document clearly, log warning on unknown header   |
| Concurrent refresh requests      | Database unique constraint + transaction          |

## Constitution Re-Check

| Principle                    | Status | Post-Design Notes                                       |
| ---------------------------- | ------ | ------------------------------------------------------- |
| I. Gateway-Centricity        | PASS   | No direct auth-service exposure                         |
| II. Error Transparency       | PASS   | Token errors logged with userId, family, reason         |
| III. Unified Response Schema | PASS   | Mobile format documented in contracts                   |
| IV. Transport-Agnostic Logic | PASS   | auth-service handles token validation, not transport    |
| V. Race Condition Prevention | PASS   | DB unique constraint prevents concurrent token creation |
