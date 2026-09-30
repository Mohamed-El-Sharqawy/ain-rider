# Research: Mobile Token Authentication

**Feature**: 003-mobile-token-auth
**Date**: 2026-03-26

## Research Topics

### 1. Token Rotation Best Practices

**Decision**: Implement rotating refresh tokens with family tracking

**Rationale**:

- OAuth 2.0 Security Best Current Practice recommends rotation
- Limits window for token theft exploitation
- Enables detection of token replay attacks
- Industry standard (Auth0, Okta, AWS Cognito all use rotation)

**Alternatives Considered**:
| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| Non-rotating tokens | Simpler implementation | Stolen tokens valid for 7 days | Security risk |
| Short-lived tokens only | No refresh needed | Frequent re-login required | Poor UX |
| Redis-based rotation | Fast lookup | No audit trail, persistence issues | Need audit capability |

**Implementation Pattern**:

```
1. User authenticates → Generate access + refresh token + create family
2. User refreshes → Validate old refresh token → Generate new tokens → Revoke old token
3. Attacker uses old token → Detect reuse → Revoke entire family → Force re-login
```

### 2. Token Storage Strategy

**Decision**: Database table with SHA-256 hash of tokens

**Rationale**:

- Storing plaintext tokens is a security risk
- SHA-256 hash allows validation without exposing tokens in DB dumps
- Family tracking enables rotation detection
- Indexes on (userId, family) for fast lookup

**Schema Design**:

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique          // SHA-256 of token
  family    String                    // UUID for rotation tracking
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, family])
  @@map("refresh_tokens")
}
```

### 3. Mobile Detection Strategy

**Decision**: X-Client-Type: mobile header (exact string match)

**Rationale**:

- Explicit opt-in by client
- No fragile user-agent parsing
- Easy to test and debug
- Clear contract between client and server

**Implementation**:

```typescript
const isMobile = request.headers.get("x-client-type") === "mobile";
```

**Alternatives Considered**:
| Approach | Pros | Cons | Rejected Because |
|----------|------|------|------------------|
| User-Agent parsing | Automatic detection | Unreliable, complex | Fragile, different per platform |
| Separate /m/auth routes | Clear separation | Code duplication | DRY violation |
| Query parameter | Simple | Tokens in URL/logs | Security risk |

### 4. Token Resolution Order

**Decision**: Bearer header first, then cookie fallback

**Rationale**:

- Consistent with RFC 6750 (Bearer Token Usage)
- Mobile clients use Bearer naturally
- Web clients continue using cookies unchanged
- Single code path for both clients

**Implementation Pattern**:

```typescript
function resolveToken(ctx: Context): string | null {
  // 1. Check Authorization header
  const authHeader = ctx.request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 2. Fall back to cookie
  return ctx.cookie.accessToken?.value ?? null;
}
```

### 5. Error Response Codes

**Decision**: TOKEN_EXPIRED vs UNAUTHORIZED distinction

**Rationale**:

- Mobile clients need to know when to refresh vs when to re-login
- TOKEN_EXPIRED → Silent refresh attempt
- UNAUTHORIZED → Redirect to login

**Error Responses**:
| Scenario | Code | HTTP Status | Client Action |
|----------|------|-------------|---------------|
| Token expired | TOKEN_EXPIRED | 401 | Attempt refresh |
| Invalid token | UNAUTHORIZED | 401 | Redirect to login |
| No token | UNAUTHORIZED | 401 | Redirect to login |
| Token reused (theft) | TOKEN_REVOKED | 401 | Redirect to login |

### 6. Token Family Revocation

**Decision**: On reuse detection, revoke all tokens in family

**Rationale**:

- Reuse of a revoked token indicates potential theft
- Attacker may have other tokens from same family
- Safest action: revoke all, force re-login
- Legitimate user will re-authenticate

**Implementation**:

```typescript
async validateRefreshToken(tokenHash: string): Promise<ValidToken> {
  const token = await this.prisma.refreshToken.findUnique({
    where: { tokenHash }
  });

  if (!token) throw new UnauthorizedException('Invalid token');
  if (token.revoked) {
    // Reuse detected - revoke entire family
    await this.prisma.refreshToken.updateMany({
      where: { family: token.family },
      data: { revoked: true }
    });
    throw new UnauthorizedException('Token revoked');
  }

  return token;
}
```

## References

- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [RFC 6750 - Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
- [Auth0 Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
