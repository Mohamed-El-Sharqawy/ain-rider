# Mobile Token Authentication Plan

The mobile app (React Native/Expo) **cannot use `httpOnly` cookies** for authentication. React Native's networking layer does not reliably support cookie-based auth the way browsers do. This document specifies the changes needed in the API Gateway to support Bearer token auth for mobile clients while keeping cookie auth working for web.

---

## Problem

The API Gateway currently:
1. Proxies login/register to `auth-service`, which returns `{ accessToken, refreshToken, user }`
2. **Strips tokens from the response body** and sets them as `httpOnly` cookies
3. Returns only `{ user, success: true }` to the client
4. The `authGuard` reads tokens exclusively from `cookies.accessToken`

This means the mobile app receives no tokens and has no way to authenticate subsequent requests.

---

## Solution: Dual Auth (Cookie + Bearer)

Support **both** cookie-based auth (web) and Bearer token auth (mobile) simultaneously. The client type is detected via a `X-Client-Type: mobile` header or by checking for `Authorization: Bearer <token>` headers.

### Changes Required

---

### 1. `POST /auth/login` — Return tokens in response body for mobile

#### Current behavior
```typescript
// apps/elysia/api-gateway/src/modules/auth/index.ts (line 48)
return { user: data.user, success: true };
// Tokens are ONLY set as cookies, never sent in the body
```

#### New behavior
```typescript
const isMobile = request.headers.get('x-client-type') === 'mobile';

// Always set cookies (for web)
accessToken.value = data.accessToken;
accessToken.httpOnly = true;
// ...cookie config...

refreshToken.value = data.refreshToken;
refreshToken.httpOnly = true;
// ...cookie config...

// For mobile: also include tokens in response body
if (isMobile) {
  return {
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    success: true,
  };
}

return { user: data.user, success: true };
```

---

### 2. `POST /auth/register` — Same change as login

Apply the identical `X-Client-Type` check to the register endpoint (line 83). Return `{ user, accessToken, refreshToken, success }` for mobile clients.

---

### 3. `POST /auth/refresh` — Accept Bearer refresh token

#### Current behavior
```typescript
// line 87-88
.post('/refresh', async ({ cookie: { accessToken, refreshToken }, set }) => {
  if (!refreshToken.value) {
    throw status(401, 'No refresh token');
  }
  const res = await AuthProxyService.refresh(refreshToken.value as string);
```

#### New behavior
```typescript
.post('/refresh', async ({ cookie: { accessToken, refreshToken }, request, set }) => {
  // Try Bearer header first (mobile), then cookie (web)
  const bearerRefresh = request.headers.get('authorization')?.replace('Bearer ', '');
  const tokenToUse = bearerRefresh || refreshToken?.value;

  if (!tokenToUse) {
    throw status(401, 'No refresh token');
  }

  const res = await AuthProxyService.refresh(tokenToUse as string);
  if (!res.ok) { /* ...existing error handling... */ }

  const data = await res.json() as { accessToken: string };
  const isMobile = request.headers.get('x-client-type') === 'mobile';

  // Always set cookie (for web)
  accessToken.value = data.accessToken;
  accessToken.httpOnly = true;
  // ...cookie config...

  // For mobile: return token in body
  if (isMobile) {
    return { accessToken: data.accessToken, success: true };
  }

  return { success: true };
});
```

---

### 4. `authGuard` — Accept Bearer token OR cookie

#### Current behavior
```typescript
// apps/elysia/api-gateway/src/modules/auth/guard.ts (line 21)
const token = cookies.accessToken?.value;
```

#### New behavior
```typescript
// Try Authorization header first (mobile), then cookie (web)
const authHeader = ctx.request?.headers?.get('authorization');
const bearerToken = authHeader?.startsWith('Bearer ') 
  ? authHeader.slice(7) 
  : null;
const token = bearerToken || cookies.accessToken?.value;
```

This is a 1-line change that makes all authenticated endpoints work with both mobile (Bearer) and web (cookie) clients.

---

### 5. `GET /auth/me` — Accept Bearer token OR cookie

#### Current behavior
```typescript
// line 124
if (!accessToken.value) {
  throw status(401, 'Not authenticated');
}
const res = await AuthProxyService.getMe(accessToken.value as string);
```

#### New behavior
```typescript
const authHeader = request.headers.get('authorization');
const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
const tokenToUse = bearerToken || accessToken?.value;

if (!tokenToUse) {
  throw status(401, 'Not authenticated');
}
const res = await AuthProxyService.getMe(tokenToUse as string);
```

---

## Files to Modify

| File | Change | Effort |
|------|--------|--------|
| `apps/elysia/api-gateway/src/modules/auth/index.ts` | Login/register return tokens for mobile, refresh accepts Bearer | ~30 lines |
| `apps/elysia/api-gateway/src/modules/auth/guard.ts` | Accept `Authorization: Bearer` header alongside cookies | ~3 lines |

**Total effort**: ~35 lines of code, no new dependencies, no breaking changes for web clients.

---

## Mobile Client Contract

After these changes, the mobile app will:

```
1. POST /auth/login
   Headers: { "X-Client-Type": "mobile" }
   Body:    { "email": "...", "password": "..." }
   
   Response: {
     "success": true,
     "user": { ... },
     "accessToken": "eyJhbG...",    ← NEW for mobile
     "refreshToken": "eyJhbG..."    ← NEW for mobile
   }

2. All authenticated requests
   Headers: { "Authorization": "Bearer <accessToken>" }
   
3. POST /auth/refresh
   Headers: { 
     "Authorization": "Bearer <refreshToken>",
     "X-Client-Type": "mobile"
   }
   
   Response: { 
     "success": true, 
     "accessToken": "eyJhbG..."    ← NEW for mobile
   }
```

---

## Security Notes

| Concern | Mitigation |
|---------|-----------|
| Token exposure in response body | Only sent when `X-Client-Type: mobile` header is present |
| Token storage on device | Mobile stores in `expo-secure-store` (Keychain/EncryptedSharedPreferences) |
| Refresh token reuse | Same 7-day expiry, same JWT verification as cookie flow |
| Web clients unaffected | Cookie flow remains unchanged — no `X-Client-Type` header = cookie-only response |
| Token in transit | HTTPS enforced in production (same TLS as cookie transport) |

---

## Testing Checklist

- [ ] Web login still works (cookies set, no tokens in body)
- [ ] Mobile login returns tokens in response body when `X-Client-Type: mobile` header is sent
- [ ] Mobile register returns tokens in response body
- [ ] `GET /auth/me` works with `Authorization: Bearer <token>` header
- [ ] `POST /auth/refresh` works with Bearer refresh token
- [ ] All `authGuard`-protected endpoints accept Bearer tokens
- [ ] Expired access token returns 401 (triggers mobile refresh)
- [ ] Invalid token returns 401
- [ ] Missing both cookie and Bearer returns 401
