# Auth Flow Comparison Across Platforms

**Workspace**: mobile, dashboard, backend
**Domain**: auth
**Date**: 2026-04-07

## Summary

This document compares authentication flows across all three platforms (mobile app, dashboard, backend) to identify inconsistencies, security issues, and integration gaps.

## Platform Overview

| Platform | Tech Stack | Token Storage | Auth Method |
|----------|------------|---------------|-------------|
| Mobile | React Native + Expo | SecureStore | Bearer token + x-client-type header |
| Dashboard | React + React Router | HTTP-only cookies | Cookie-based + Bearer fallback |
| Backend | Elysia + JWT | N/A (stateless) | JWT verification |

---

## Auth Flow Diagrams

### Mobile Auth Flow

```
1. Login/Register
   User -> Mobile App -> POST /auth/login (x-client-type: mobile)
   Gateway -> Auth Service -> Validate credentials
   Auth Service -> Gateway -> { user, accessToken, refreshToken }
   Gateway -> Mobile App -> { user, accessToken, refreshToken } (in body)
   Mobile App -> SecureStore -> Store tokens

2. Subsequent Requests
   Mobile App -> API -> Authorization: Bearer {accessToken}
   Gateway -> Auth Service -> Validate token
   Auth Service -> Gateway -> User data
   Gateway -> Mobile App -> Response

3. Token Refresh
   Mobile App -> API -> POST /auth/refresh (Authorization: Bearer {refreshToken})
   Gateway -> Auth Service -> Validate refresh token
   Auth Service -> Gateway -> { accessToken, refreshToken }
   Gateway -> Mobile App -> New tokens (in body)
   Mobile App -> SecureStore -> Update tokens

4. App Start (useAuthCheck)
   Mobile App -> SecureStore -> Get accessToken
   Mobile App -> JWT Decode -> Check expiry
   If valid -> Set auth state
   If expired -> Attempt refresh
   If refresh fails -> Redirect to login
```

### Dashboard Auth Flow

```
1. Login
   User -> Dashboard -> POST /auth/login (withCredentials: true)
   Gateway -> Auth Service -> Validate credentials
   Auth Service -> Gateway -> { user, accessToken, refreshToken }
   Gateway -> Browser -> Set HTTP-only cookies (accessToken, refreshToken)
   Gateway -> Dashboard -> { user, success: true }

2. Subsequent Requests
   Dashboard -> API -> Cookies sent automatically
   Gateway -> Auth Service -> Validate token from cookie
   Auth Service -> Gateway -> User data
   Gateway -> Dashboard -> Response

3. Token Refresh
   API Client (401) -> POST /auth/refresh (cookie sent automatically)
   Gateway -> Auth Service -> Validate refresh token
   Auth Service -> Gateway -> { accessToken, refreshToken }
   Gateway -> Browser -> Update cookies
   API Client -> Retry original request

4. Page Load (ProtectedRoute)
   Dashboard -> useGetMe() -> GET /auth/me
   Gateway -> Auth Service -> Validate token
   Auth Service -> Gateway -> User data
   Dashboard -> Zustand -> Set user state
```

### Backend Auth Flow

```
1. Token Generation (Auth Service)
   Login request -> Validate credentials
   Generate JWT accessToken (15 min expiry)
   Generate JWT refreshToken (7 days expiry)
   Return tokens

2. Token Validation (All Services)
   Request -> Extract token from Authorization header or cookie
   Verify JWT signature
   Check expiry
   Extract user info (sub, role, email)
   Attach user to request context

3. Internal Service Auth (API Gateway -> Services)
   Gateway -> Generate internal JWT (service: 'api-gateway', internal: true)
   Gateway -> Service -> Authorization: Bearer {internalToken}
   Service -> Verify internal secret
   Service -> Process request
```

---

## Comparison Matrix

### Token Storage

| Aspect | Mobile | Dashboard | Backend |
|--------|--------|-----------|---------|
| Storage | SecureStore | HTTP-only cookie | N/A |
| Accessible to JS | Yes | No | N/A |
| CSRF protection | N/A | SameSite cookie | N/A |
| XSS protection | Secure storage | HTTP-only | N/A |
| Persistence | Manual | Automatic | N/A |

### Token Format

| Aspect | Mobile | Dashboard | Backend |
|--------|--------|-----------|---------|
| Access token expiry | 15 min | 15 min | 15 min |
| Refresh token expiry | 7 days | 7 days | 7 days |
| Token type | JWT | JWT | JWT |
| Algorithm | HS256 | HS256 | HS256 |

### Auth Headers

| Aspect | Mobile | Dashboard |
|--------|--------|-----------|
| Default method | Bearer header | Cookie |
| Fallback | N/A | Bearer header |
| Special headers | x-client-type: mobile | withCredentials: true |

### Token Refresh

| Aspect | Mobile | Dashboard |
|--------|--------|-----------|
| Trigger | 401 response | 401 response |
| Method | Manual via interceptor | Automatic via interceptor |
| Refresh endpoint | POST /auth/refresh | POST /auth/refresh |
| Token sent via | Bearer header | Cookie |
| Queue mechanism | No | Yes (failedQueue) |
| Race condition | Yes | Partial handling |

---

## Issues Found

### CRITICAL AUTH-COMPARE-001: Mobile Token Refresh Race Condition

- **Files**: `mobile/lib/api/client.ts`
- **Category**: bug
- **Impact**: Multiple refresh requests, auth failures

**Description**

Mobile has no queue mechanism for pending requests during refresh:

```tsx
// Mobile - No queue
if (status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  const refreshed = await refreshTokens(); // Multiple calls possible
  return request(originalRequest);
}
```

Dashboard has a queue but it has edge cases:

```tsx
// Dashboard - Has queue but issues
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  });
}
```

**Recommendation**

Implement proper singleton refresh lock in both platforms (see AUTH-WS-002).

---

### CRITICAL AUTH-COMPARE-002: Inconsistent Token Delivery

- **Files**: 
  - `backend/apps/elysia/api-gateway/src/modules/auth/index.ts`
  - `mobile/lib/api/auth.api.ts`
  - `dashboard/src/pages/login/services/api.ts`
- **Category**: integration
- **Impact**: Confusion, potential bugs

**Description**

Mobile receives tokens in response body, Dashboard receives via cookies. This is by design but requires special handling:

**Backend**:
```tsx
// Different token delivery based on client type
if (isMobileClient(request.headers)) {
  responseBody.accessToken = data.accessToken;
  responseBody.refreshToken = data.refreshToken;
}
// Dashboard gets cookies automatically
```

**Mobile must send header**:
```tsx
headers.set('x-client-type', 'mobile');
```

**Dashboard must use credentials**:
```tsx
api.post("/auth/login", data, { withCredentials: true });
```

**Recommendation**

Document this pattern clearly:
```tsx
/**
 * Token Delivery:
 * - Mobile: Tokens in response body (requires x-client-type: mobile header)
 * - Dashboard: Tokens in HTTP-only cookies (requires withCredentials: true)
 * 
 * This is intentional:
 * - Mobile needs programmatic access for SecureStore
 * - Dashboard uses cookies for CSRF protection
 */
```

---

### HIGH AUTH-COMPARE-003: Dashboard Auth Store Not Persisted

- **Files**: `dashboard/src/stores/authStore.ts`
- **Category**: bug
- **Impact**: User logged out on page refresh

**Description**

Mobile persists tokens in SecureStore, but Dashboard doesn't persist auth state:

**Mobile**:
```tsx
// Tokens stored in SecureStore - persistent
await SecureStore.setItemAsync('accessToken', token);
```

**Dashboard**:
```tsx
// Auth state in memory only - lost on refresh
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  // No persistence
}));
```

**Recommendation**

Use Zustand persist middleware (see AUTH-WS-004).

---

### HIGH AUTH-COMPARE-004: Missing Role-Based Access Control

- **Files**: 
  - `mobile/hooks/useAuthCheck.ts`
  - `dashboard/src/components/shared/ProtectedRoute.tsx`
- **Category**: security
- **Impact**: Unauthorized access

**Description**

Mobile doesn't check role at all, Dashboard checks role implicitly:

**Mobile**:
```tsx
// No role check - just validates token
const decoded = jwtDecode<TokenPayload>(accessToken);
if (decoded.exp > currentTime) {
  setAuth(true, decoded.role); // Role stored but not checked
}
```

**Dashboard**:
```tsx
// Implicit role check - only ADMIN/SUPPORT can set auth
if (data.role === 'ADMIN' || data.role === 'SUPPORT') {
  setUser(data);
}
// But the redirect check doesn't verify role explicitly
```

**Recommendation**

Implement explicit role checks in both platforms:
```tsx
// Mobile
const ALLOWED_ROLES = ['RIDER', 'DRIVER'];
if (!ALLOWED_ROLES.includes(decoded.role)) {
  clearAuth();
  router.replace('/login');
}

// Dashboard
const ALLOWED_ROLES = ['ADMIN', 'SUPPORT'];
if (!ALLOWED_ROLES.includes(user.role)) {
  clear();
  return <Navigate to="/login" />;
}
```

---

### MEDIUM AUTH-COMPARE-005: Different Logout Implementations

- **Files**:
  - `mobile/lib/api/auth.api.ts`
  - `dashboard/src/pages/login/services/api.ts`
- **Category**: consistency
- **Impact**: Incomplete logout

**Description**

Mobile doesn't call logout endpoint:

**Mobile**:
```tsx
// No logout API call
async function logout() {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  clearAuth();
  router.replace('/login');
}
```

**Dashboard**:
```tsx
// Calls logout endpoint to clear cookies
logout: () => api.post<{ success: boolean }>("/auth/logout"),
```

**Recommendation**

Mobile should call logout endpoint to invalidate server-side sessions:
```tsx
async function logout() {
  try {
    await AuthApi.logout(); // Invalidate server session
  } catch {
    // Ignore errors
  }
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  clearAuth();
  router.replace('/login');
}
```

---

### MEDIUM AUTH-COMPARE-006: Missing Token Expiry Warning

- **Files**: All platforms
- **Category**: ux
- **Impact**: Unexpected logout

**Description**

Neither platform warns users before token expiry.

**Recommendation**

Add token expiry monitoring (see AUTH-WS-008).

---

### MEDIUM AUTH-COMPARE-007: WebSocket Auth Inconsistent

- **Files**:
  - `mobile/services/websocket.service.ts`
  - `dashboard/src/hooks/useWebSocket.ts`
- **Category**: security
- **Impact**: Unauthorized WebSocket access

**Description**

Neither platform sends auth token on WebSocket connection:

**Mobile**:
```tsx
connect(wsUrl: string): void {
  this.ws = new ReconnectingWebSocket(wsUrl);
  // No auth
}
```

**Dashboard**:
```tsx
const ws = new WebSocket(WS_URL);
// No auth
```

**Recommendation**

Implement WebSocket auth (see AUTH-WS-001).

---

### LOW AUTH-COMPARE-008: Different Error Handling Patterns

- **Files**: All platforms
- **Category**: consistency
- **Impact**: Inconsistent user experience

**Description**

**Mobile**:
```tsx
// Throws ApiError with status
throw new ApiError(status, await response.text());
```

**Dashboard**:
```tsx
// Uses getApiError helper
export function getApiError(error: unknown): string {
  // Extracts message from various formats
}
```

**Recommendation**

Standardize error handling across platforms.

---

### LOW AUTH-COMPARE-009: Missing UserId in Mobile Auth State

- **Files**: `mobile/hooks/useAuthCheck.ts`
- **Category**: bug
- **Impact**: userId not available for WebSocket subscriptions

**Description**

Mobile extracts role from JWT but not userId:

```tsx
const decoded = jwtDecode<TokenPayload>(accessToken);
setAuth(true, decoded.role); // Missing userId
```

Dashboard gets userId from `/auth/me` response.

**Recommendation**

Extract userId from JWT:
```tsx
setAuth(true, decoded.role, decoded.sub || decoded.userId);
```

---

## Recommendations Summary

### Critical (Fix Immediately)
1. Implement token refresh race condition fix (both platforms)
2. Add explicit role-based access control (both platforms)

### High (Fix Soon)
3. Add Zustand persistence to dashboard auth store
4. Add WebSocket authentication

### Medium (Fix Eventually)
5. Standardize logout implementation
6. Add token expiry warning
7. Document token delivery pattern

### Low (Nice to Have)
8. Standardize error handling
9. Extract userId in mobile auth check