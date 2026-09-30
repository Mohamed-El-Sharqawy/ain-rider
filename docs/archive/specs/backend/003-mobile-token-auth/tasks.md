# Tasks: Mobile Token Authentication

**Input**: Design documents from `/specs/003-mobile-token-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-routes.md, quickstart.md

**Tests**: Not explicitly requested - test tasks excluded.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

```
apps/
├── elysia/api-gateway/src/modules/auth/    # Gateway auth module
│   ├── index.ts                             # Routes: login, register, refresh, me, logout
│   ├── guard.ts                             # authGuard plugin
│   └── service.ts                           # Proxy to auth-service (UNCHANGED)
│
└── nest/auth-service/
    ├── prisma/schema.prisma                 # Database schema
    └── src/auth/auth.service.ts             # Token generation and validation
```

---

## Phase 1: Database Schema (Foundational)

**Purpose**: Add RefreshToken model for token rotation tracking. This MUST be done first as auth-service depends on it.

**⚠️ CRITICAL**: Run database migration after this phase before proceeding.

### Tasks

- [x] T001 Add RefreshToken model to Prisma schema in `apps/nest/auth-service/prisma/schema.prisma`

**Detailed Instructions for T001:**

Add the following model to the END of `apps/nest/auth-service/prisma/schema.prisma` (after the Rider model):

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  family    String
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, family])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

Then add the relation to the User model. Find the User model and add this line after `updatedAt`:

```prisma
  refreshTokens RefreshToken[]
```

**After T001, run migration:**

```bash
cd apps/nest/auth-service
npx prisma db push
```

---

## Phase 2: Auth Service Token Rotation (Backend Logic)

**Purpose**: Implement token rotation and reuse detection in auth-service. This enables all user stories.

### Tasks

- [x] T002 Add crypto import and helper methods to `apps/nest/auth-service/src/auth/auth.service.ts`
- [x] T003 Implement storeRefreshToken method in `apps/nest/auth-service/src/auth/auth.service.ts`
- [x] T004 Implement validateRefreshToken method with reuse detection in `apps/nest/auth-service/src/auth/auth.service.ts`
- [x] T005 Implement rotateRefreshToken method in `apps/nest/auth-service/src/auth/auth.service.ts`
- [x] T006 Modify register method to store refresh token in `apps/nest/auth-service/src/auth/auth.service.ts`
- [x] T007 Modify login method to store refresh token in `apps/nest/auth-service/src/auth/auth.service.ts`
- [x] T008 Modify refresh method to use token rotation in `apps/nest/auth-service/src/auth/auth.service.ts`

### Detailed Instructions

---

#### T002: Add crypto import and helper methods

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

**Step 1**: Add crypto import at the top of the file (after existing imports):

```typescript
import * as crypto from "crypto";
```

**Step 2**: Add these helper methods inside the AuthService class (add them before the `private signAccessToken` method):

```typescript
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateFamilyId(): string {
    return crypto.randomUUID();
  }
```

---

#### T003: Implement storeRefreshToken method

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

Add this method inside the AuthService class (after the helper methods from T002):

```typescript
  private async storeRefreshToken(
    userId: string,
    token: string,
    family: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        family,
        expiresAt,
      },
    });
  }
```

---

#### T004: Implement validateRefreshToken method with reuse detection

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

Add this method inside the AuthService class (after storeRefreshToken):

```typescript
  private async validateRefreshToken(
    token: string,
  ): Promise<{ userId: string; family: string } | null> {
    const tokenHash = this.hashToken(token);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      return null;
    }

    if (storedToken.revoked) {
      // Reuse detected - revoke entire family
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revoked: true },
      });
      return null;
    }

    if (storedToken.expiresAt < new Date()) {
      return null;
    }

    return { userId: storedToken.userId, family: storedToken.family };
  }
```

---

#### T005: Implement rotateRefreshToken method

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

Add this method inside the AuthService class (after validateRefreshToken):

```typescript
  private async rotateRefreshToken(
    oldToken: string,
    newToken: string,
    family: string,
  ): Promise<void> {
    const oldTokenHash = this.hashToken(oldToken);

    // Mark old token as revoked
    await this.prisma.refreshToken.update({
      where: { tokenHash: oldTokenHash },
      data: { revoked: true },
    });

    // Store new token in same family
    const userId = await this.prisma.refreshToken
      .findUnique({ where: { tokenHash: oldTokenHash } })
      .then(t => t?.userId);

    if (userId) {
      await this.storeRefreshToken(userId, newToken, family);
    }
  }
```

---

#### T006: Modify register method to store refresh token

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

**Locate the register method** (around line 19). Find this part:

```typescript
return {
  user: this.sanitize(user),
  accessToken: this.signAccessToken(user),
  refreshToken: this.signRefreshToken(user),
};
```

**Replace it with:**

```typescript
const family = this.generateFamilyId();
const accessToken = this.signAccessToken(user);
const refreshToken = this.signRefreshToken(user, family);

await this.storeRefreshToken(user.id, refreshToken, family);

return {
  user: this.sanitize(user),
  accessToken,
  refreshToken,
};
```

---

#### T007: Modify login method to store refresh token

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

**Locate the login method** (around line 59). Find this part:

```typescript
return {
  user: this.sanitize(user),
  accessToken: this.signAccessToken(user),
  refreshToken: this.signRefreshToken(user),
};
```

**Replace it with:**

```typescript
const family = this.generateFamilyId();
const accessToken = this.signAccessToken(user);
const refreshToken = this.signRefreshToken(user, family);

await this.storeRefreshToken(user.id, refreshToken, family);

return {
  user: this.sanitize(user),
  accessToken,
  refreshToken,
};
```

---

#### T008: Modify refresh method to use token rotation

**File**: `apps/nest/auth-service/src/auth/auth.service.ts`

**Step 1**: Update the signRefreshToken method to accept family parameter.

Find this method:

```typescript
  private signRefreshToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, type: 'refresh' },
      { expiresIn: '7d' },
    );
  }
```

**Replace with:**

```typescript
  private signRefreshToken(user: { id: string; email: string; role: string }, family?: string) {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, type: 'refresh', family: family || '' },
      { expiresIn: '7d' },
    );
  }
```

**Step 2**: Update the refresh method.

Find this method:

```typescript
  async refresh(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return { accessToken: this.signAccessToken(user) };
  }
```

**Replace with:**

```typescript
  async refresh(oldRefreshToken: string) {
    const tokenData = await this.validateRefreshToken(oldRefreshToken);

    if (!tokenData) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: tokenData.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user, tokenData.family);

    await this.rotateRefreshToken(oldRefreshToken, refreshToken, tokenData.family);

    return { accessToken, refreshToken };
  }
```

---

## Phase 3: User Story 1 & 2 - Mobile Login/Register (Priority: P1) 🎯 MVP

**Goal**: Mobile clients can login and register, receiving tokens in response body.

**Independent Test**: Send POST /auth/login with X-Client-Type: mobile header, verify tokens in response body.

### Tasks

- [x] T009 [P] [US1] Add isMobile helper function in `apps/elysia/api-gateway/src/modules/auth/index.ts`
- [x] T010 [US1] Modify login route to return tokens for mobile clients in `apps/elysia/api-gateway/src/modules/auth/index.ts`
- [x] T011 [US2] Modify register route to return tokens for mobile clients in `apps/elysia/api-gateway/src/modules/auth/index.ts`

### Detailed Instructions

---

#### T009: Add isMobile helper function

**File**: `apps/elysia/api-gateway/src/modules/auth/index.ts`

Add this helper function at the top of the file, after the const declarations (after line 8):

```typescript
const isMobileClient = (headers: Headers): boolean => {
  return headers.get("x-client-type") === "mobile";
};
```

---

#### T010: Modify login route to return tokens for mobile clients

**File**: `apps/elysia/api-gateway/src/modules/auth/index.ts`

**Locate the login route** (starts around line 17). Find the return statement:

```typescript
return { user: data.user, success: true };
```

**Replace it with:**

```typescript
const response: any = { user: data.user, success: true };

// Mobile clients need tokens in body
if (isMobileClient(request.headers)) {
  response.accessToken = data.accessToken;
  response.refreshToken = data.refreshToken;
}

return response;
```

**Note**: You also need to add `request` to the destructured parameters. Change:

```typescript
async({ body, cookie: { accessToken, refreshToken }, set });
```

To:

```typescript
async({ body, cookie: { accessToken, refreshToken }, set, request });
```

---

#### T011: Modify register route to return tokens for mobile clients

**File**: `apps/elysia/api-gateway/src/modules/auth/index.ts`

**Locate the register route** (starts around line 52). Find the return statement:

```typescript
return { user: data.user, success: true };
```

**Replace it with:**

```typescript
const response: any = { user: data.user, success: true };

// Mobile clients need tokens in body
if (isMobileClient(request.headers)) {
  response.accessToken = data.accessToken;
  response.refreshToken = data.refreshToken;
}

return response;
```

**Note**: Also add `request` to the destructured parameters (same as T010).

---

## Phase 4: User Story 3 - Token Refresh (Priority: P1)

**Goal**: Mobile clients can refresh tokens using Bearer header.

**Independent Test**: Send POST /auth/refresh with Authorization: Bearer <refresh-token> and X-Client-Type: mobile header, verify new tokens in response.

### Tasks

- [x] T012 [US3] Modify refresh route to accept Bearer token in `apps/elysia/api-gateway/src/modules/auth/index.ts`
- [x] T013 [US3] Modify refresh route to return tokens for mobile clients in `apps/elysia/api-gateway/src/modules/auth/index.ts`

### Detailed Instructions

---

#### T012: Modify refresh route to accept Bearer token

**File**: `apps/elysia/api-gateway/src/modules/auth/index.ts`

**Locate the refresh route** (starts around line 87). Find this code:

```typescript
  .post('/refresh', async ({ cookie: { accessToken, refreshToken }, set }) => {
    if (!refreshToken.value) {
      throw status(401, 'No refresh token');
    }

    const res = await AuthProxyService.refresh(refreshToken.value as string);
```

**Replace with:**

```typescript
  .post('/refresh', async ({ cookie: { accessToken, refreshToken }, set, request }) => {
    // Resolve token: Bearer header first, then cookie fallback
    const authHeader = request.headers.get('authorization');
    let token: string;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (refreshToken.value) {
      token = refreshToken.value as string;
    } else {
      throw status(401, 'No refresh token');
    }

    const res = await AuthProxyService.refresh(token);
```

---

#### T013: Modify refresh route to return tokens for mobile clients

**File**: `apps/elysia/api-gateway/src/modules/auth/index.ts`

**Locate the return statement in refresh route** (around line 109):

```typescript
return { success: true };
```

**Replace with:**

```typescript
const response: any = { success: true };

// Mobile clients need new tokens in body
if (isMobileClient(request.headers)) {
  const refreshData = data as { accessToken: string; refreshToken?: string };
  response.accessToken = refreshData.accessToken;
  if (refreshData.refreshToken) {
    response.refreshToken = refreshData.refreshToken;
  }
}

return response;
```

---

## Phase 5: User Story 4 - Authenticated Route Access (Priority: P1)

**Goal**: Protected routes accept Bearer token with cookie fallback.

**Independent Test**: Send GET /auth/me with Authorization: Bearer <access-token>, verify user data returned.

### Tasks

- [x] T014 [US4] Modify authGuard to resolve token from Bearer header first in `apps/elysia/api-gateway/src/modules/auth/guard.ts`
- [x] T015 [US4] Add TOKEN_EXPIRED vs UNAUTHORIZED error distinction in `apps/elysia/api-gateway/src/modules/auth/guard.ts`
- [x] T016 [US4] Modify /auth/me route to use Bearer header in `apps/elysia/api-gateway/src/modules/auth/index.ts`

### Detailed Instructions

---

#### T014: Modify authGuard to resolve token from Bearer header first

**File**: `apps/elysia/api-gateway/src/modules/auth/guard.ts`

**Locate the derive function** (around line 18). Find this code:

```typescript
  .derive({ as: 'scoped' }, async (ctx) => {
    const { cookie: cookies, jwt } = ctx;

    const token = cookies.accessToken?.value;

    console.log('[AuthGuard] Cookie check:', {
      hasCookie: !!cookies.accessToken,
      hasValue: !!token,
      tokenPreview: token ? (token as string).substring(0, 20) + '...' : 'none',
    });

    if (!token) {
      throw new UnauthorizedError('Not authenticated - no access token');
    }
```

**Replace with:**

```typescript
  .derive({ as: 'scoped' }, async (ctx) => {
    const { cookie: cookies, jwt, request } = ctx;

    // Resolve token: Bearer header first, then cookie fallback
    const authHeader = request.headers.get('authorization');
    let token: string | undefined;
    let tokenSource = 'none';

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
      tokenSource = 'bearer';
    } else if (cookies.accessToken?.value) {
      token = cookies.accessToken.value as string;
      tokenSource = 'cookie';
    }

    console.log('[AuthGuard] Token resolution:', {
      source: tokenSource,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
    });

    if (!token) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Not authenticated - no access token');
    }
```

---

#### T015: Add TOKEN_EXPIRED vs UNAUTHORIZED error distinction

**File**: `apps/elysia/api-gateway/src/modules/auth/guard.ts`

**Step 1**: Find the try-catch block in the derive function:

```typescript
try {
  const payload = (await jwt.verify(token as string)) as unknown as JwtPayload;

  return {
    accessToken: token,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    },
  };
} catch {
  throw new UnauthorizedError("Invalid or expired access token");
}
```

**Replace with:**

```typescript
try {
  const payload = (await jwt.verify(token as string)) as unknown as JwtPayload;

  return {
    accessToken: token,
    user: {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    },
  };
} catch (error: any) {
  // Distinguish between expired and invalid tokens
  if (
    error?.name === "TokenExpiredError" ||
    error?.message?.includes("expired")
  ) {
    throw new UnauthorizedError("TOKEN_EXPIRED", "Access token has expired");
  }
  throw new UnauthorizedError("UNAUTHORIZED", "Invalid access token");
}
```

**Step 2**: Check if UnauthorizedError constructor supports code parameter.

Read `packages/error-handling/src/index.ts` to see the UnauthorizedError signature. If it only accepts message, update the constructor calls:

```typescript
// If UnauthorizedError only accepts message:
throw new UnauthorizedError("TOKEN_EXPIRED: Access token has expired");
throw new UnauthorizedError("UNAUTHORIZED: Invalid access token");
```

---

#### T016: Modify /auth/me route to use Bearer header

**File**: `apps/elysia/api-gateway/src/modules/auth/index.ts`

**Locate the /auth/me route** (starts around line 117). Find this code:

```typescript
  .get('/me', async ({ cookie: { accessToken }, request, set }) => {
    console.log('[/auth/me] Request:', {
      hasCookie: !!accessToken,
      hasValue: !!accessToken?.value,
      cookieHeader: request.headers.get('cookie'),
    });

    if (!accessToken.value) {
      throw status(401, 'Not authenticated');
    }

    const res = await AuthProxyService.getMe(accessToken.value as string);
```

**Replace with:**

```typescript
  .get('/me', async ({ cookie: { accessToken }, request, set }) => {
    // Resolve token: Bearer header first, then cookie fallback
    const authHeader = request.headers.get('authorization');
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (accessToken?.value) {
      token = accessToken.value as string;
    }

    console.log('[/auth/me] Token resolution:', {
      source: authHeader?.startsWith('Bearer ') ? 'bearer' : (token ? 'cookie' : 'none'),
      hasToken: !!token,
    });

    if (!token) {
      throw status(401, 'Not authenticated');
    }

    const res = await AuthProxyService.getMe(token);
```

---

## Phase 6: Polish & Validation

**Purpose**: Verify all changes work correctly.

### Tasks

- [x] T017 Regenerate Prisma client after schema changes
- [x] T018 Run linting on modified files
- [x] T019 Verify quickstart.md scenarios manually

### Detailed Instructions

---

#### T017: Regenerate Prisma client

```bash
cd apps/nest/auth-service
npx prisma generate
```

---

#### T018: Run linting

```bash
cd apps/elysia/api-gateway && npm run lint
cd apps/nest/auth-service && npm run lint
```

---

#### T019: Verify quickstart.md scenarios

Follow the test scenarios in `specs/003-mobile-token-auth/quickstart.md`:

1. **Web Login**: Verify no tokens in body, cookies set
2. **Mobile Login**: Verify tokens in body AND cookies set
3. **Mobile Register**: Verify tokens in body
4. **Protected Route with Bearer**: Verify 200 response
5. **Protected Route with Cookie**: Verify 200 response
6. **Refresh with Bearer**: Verify new tokens in body
7. **Expired Token**: Verify TOKEN_EXPIRED error
8. **Missing Token**: Verify UNAUTHORIZED error
9. **Token Reuse**: Verify family revocation

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Database) → Phase 2 (Auth Service) → Phase 3-5 (User Stories) → Phase 6 (Polish)
```

### Task Dependencies Within Phases

**Phase 1:**

- T001 must complete and migration must run before Phase 2

**Phase 2:**

- T002 → T003 → T004 → T005 (sequential, build on each other)
- T006, T007, T008 depend on T002-T005 being complete

**Phase 3:**

- T009 must complete first (provides helper function)
- T010, T011 can run in parallel after T009

**Phase 4:**

- T012 must complete before T013

**Phase 5:**

- T014 → T015 (sequential)
- T016 can run in parallel with T014-T015

**Phase 6:**

- All previous phases must complete
- T017 → T018 → T019 (sequential)

### Parallel Opportunities

| Phase   | Parallel Tasks           |
| ------- | ------------------------ |
| Phase 3 | T010 and T011 after T009 |
| Phase 5 | T016 with T014-T015      |

---

## Implementation Strategy

### MVP (Minimum Viable Product)

Complete Phases 1-3 for basic mobile login/register functionality:

1. Phase 1: Database schema
2. Phase 2: Auth service token rotation
3. Phase 3: Login/register routes

**At this point**: Mobile users can login and register, receiving tokens.

### Full Feature

Continue with Phases 4-6:

4. Phase 4: Token refresh
5. Phase 5: Protected route access
6. Phase 6: Validation

---

## Summary

| Metric                   | Value    |
| ------------------------ | -------- |
| Total Tasks              | 19       |
| Phase 1 (Database)       | 1 task   |
| Phase 2 (Auth Service)   | 7 tasks  |
| Phase 3 (Login/Register) | 3 tasks  |
| Phase 4 (Refresh)        | 2 tasks  |
| Phase 5 (Auth Guard)     | 3 tasks  |
| Phase 6 (Polish)         | 3 tasks  |
| Parallel Opportunities   | 2 groups |

---

## Notes

- All file paths are relative to repository root `D:\Work\ain-rider\backend`
- Each task includes exact code changes with before/after examples
- Run database migration after Phase 1 before proceeding
- Test each user story independently after completion
- Commit after each task or logical group
