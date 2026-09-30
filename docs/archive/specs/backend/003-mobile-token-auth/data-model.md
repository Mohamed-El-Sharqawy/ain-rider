# Data Model: Mobile Token Authentication

**Feature**: 003-mobile-token-auth
**Date**: 2026-03-26

## Entity Changes

### New Entity: RefreshToken

Stores refresh tokens for rotation tracking and revocation capability.

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique              // SHA-256 hash of the JWT
  family    String                        // UUID grouping tokens from same auth session
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, family])
  @@index([expiresAt)
  @@map("refresh_tokens")
}
```

**Field Descriptions**:

| Field     | Type     | Purpose                                                              |
| --------- | -------- | -------------------------------------------------------------------- |
| id        | UUID     | Primary key                                                          |
| userId    | UUID     | Owner of the token                                                   |
| tokenHash | String   | SHA-256 hash of JWT for validation without plaintext storage         |
| family    | UUID     | Groups tokens from same authentication session for rotation tracking |
| expiresAt | DateTime | Token expiration (7 days from creation)                              |
| revoked   | Boolean  | Whether token has been rotated away or revoked                       |
| createdAt | DateTime | Audit timestamp                                                      |

**Indexes**:

- `userId, family`: Fast lookup of all tokens in a family (for revocation)
- `expiresAt`: Cleanup job can delete expired tokens
- `tokenHash` (unique): Fast token validation

### Modified Entity: User

No schema changes. Relation added for RefreshToken.

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  phoneNumber  String   @unique
  passwordHash String
  firstName    String
  lastName     String
  role         String
  status       String   @default("ACTIVE")
  profileImage String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  refreshTokens RefreshToken[]  // NEW: relation

  @@map("users")
}
```

## State Transitions

### RefreshToken Lifecycle

```
┌─────────────┐     create      ┌─────────────┐
│   Created   │ ──────────────► │   Active    │
└─────────────┘                 └──────┬──────┘
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                    rotate                      expire
                         │                           │
                         ▼                           ▼
                 ┌─────────────┐             ┌─────────────┐
                 │   Revoked   │             │   Expired   │
                 └─────────────┘             └─────────────┘
```

**States**:

- **Created**: Initial state after authentication
- **Active**: Valid token, can be used for refresh
- **Revoked**: Token was rotated or family was revoked
- **Expired**: Token passed expiration time (cleanup target)

## Token Family Rotation

```
Auth Flow:
┌─────────┐    login     ┌─────────────────┐
│  User   │ ───────────► │ Token A (family) │
└─────────┘              └─────────────────┘

Refresh Flow:
┌─────────────────┐    refresh    ┌─────────────────┐
│ Token A (valid) │ ────────────► │ Token B (same   │
│                 │               │     family)     │
└─────────────────┘               └─────────────────┘
        │
        ▼
┌─────────────────┐
│ Token A revoked │
└─────────────────┘

Reuse Detection:
┌─────────────────┐    reuse     ┌─────────────────┐
│ Token A (revoked│ ───────────► │ All tokens in   │
│     but valid)  │              │ family revoked  │
└─────────────────┘              └─────────────────┘
```

## Migration

```sql
-- Add refresh_tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  family UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_refresh_tokens_user_family ON refresh_tokens(user_id, family);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Comment for documentation
COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for rotation tracking';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of JWT';
COMMENT ON COLUMN refresh_tokens.family IS 'UUID grouping tokens from same auth session';
```

## Cleanup Strategy

Expired tokens should be periodically cleaned up:

```sql
-- Run daily via cron job or pg_cron
DELETE FROM refresh_tokens
WHERE expires_at < NOW() - INTERVAL '1 day';
```

## Performance Considerations

| Operation       | Query Pattern                     | Index Used          |
| --------------- | --------------------------------- | ------------------- |
| Validate token  | `WHERE tokenHash = ?`             | tokenHash unique    |
| Rotate token    | `WHERE userId = ? AND family = ?` | userId, family      |
| Revoke family   | `UPDATE WHERE family = ?`         | userId, family scan |
| Cleanup expired | `WHERE expiresAt < ?`             | expiresAt           |
