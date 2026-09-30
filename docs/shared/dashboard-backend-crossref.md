# Dashboard API Calls vs Backend Endpoints Cross-Reference

**Workspace**: dashboard, backend
**Domain**: api, integration
**Date**: 2026-04-07

## Summary

This document cross-references all dashboard API calls against backend API Gateway endpoints to identify mismatches, missing endpoints, and integration issues.

## Endpoint Mapping

### Auth Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `authApi.login()` | `/auth/login` | POST | Match | Cookie-based auth |
| `authApi.getMe()` | `/auth/me` | GET | Match | Bearer or cookie |
| `authApi.logout()` | `/auth/logout` | POST | Match | Clears cookies |

### Admin Complaints Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `complaintsApi.getAll()` | `/admin/complaints` | GET | **PROXY** | Via admin proxy |
| `complaintsApi.getById()` | `/admin/complaints/:id` | GET | **PROXY** | Via admin proxy |
| `complaintsApi.create()` | `/admin/complaints` | POST | **PROXY** | Via admin proxy |
| `complaintsApi.updateStatus()` | `/admin/complaints/:id/status` | PATCH | **PROXY** | Via admin proxy |
| `complaintsApi.addComment()` | `/admin/complaints/:id/comments` | POST | **PROXY** | Via admin proxy |

### Admin Notifications Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `notificationsApi.getAll()` | `/admin/notifications` | GET | **PROXY** | Via admin proxy |
| `notificationsApi.getMyNotifications()` | `/admin/notifications/me` | GET | **PROXY** | Via admin proxy |
| `notificationsApi.getByUser()` | `/admin/notifications/user/:userId` | GET | **PROXY** | Via admin proxy |
| `notificationsApi.create()` | `/admin/notifications` | POST | **PROXY** | Via admin proxy |
| `notificationsApi.sendPush()` | `/admin/notifications/push` | POST | **PROXY** | Via admin proxy |
| `notificationsApi.sendSms()` | `/admin/notifications/sms` | POST | **PROXY** | Via admin proxy |
| `notificationsApi.markRead()` | `/admin/notifications/:id/read` | PATCH | **PROXY** | Via admin proxy |
| `notificationsApi.markAllAsRead()` | `/admin/notifications/read-all` | PATCH | **PROXY** | Via admin proxy |

### Admin Profile Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `profileApi.getProfile()` | `/admin/profile` | GET | **PROXY** | Via admin proxy |
| `profileApi.updateProfile()` | `/admin/profile` | PATCH | **PROXY** | Via admin proxy |
| `profileApi.generateUploadUrl()` | `/admin/profile/upload-url` | POST | **PROXY** | Via admin proxy |
| `profileApi.deleteProfileImage()` | `/admin/profile/image` | DELETE | **PROXY** | Via admin proxy |

### Admin Promos Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `promosApi.getAll()` | `/admin/promos` | GET | **PROXY** | Via admin proxy |
| `promosApi.getByCode()` | `/admin/promos/:code` | GET | **PROXY** | Via admin proxy |
| `promosApi.create()` | `/admin/promos` | POST | **PROXY** | Via admin proxy |
| `promosApi.update()` | `/admin/promos/:id` | PATCH | **PROXY** | Via admin proxy |

### Admin Settings Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `settingsApi.getAll()` | `/admin/settings` | GET | **PROXY** | Via admin proxy |
| `settingsApi.getByKey()` | `/admin/settings/:key` | GET | **PROXY** | Via admin proxy |
| `settingsApi.upsert()` | `/admin/settings/:key` | PUT | **PROXY** | Via admin proxy |
| `settingsApi.batchUpsert()` | `/admin/settings/batch` | POST | **PROXY** | Via admin proxy |

### Admin Trips Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `tripsApi.getAll()` | `/admin/trips` | GET | **PROXY** | Via admin proxy |
| `tripsApi.getById()` | `/admin/trips/:id` | GET | **PROXY** | Via admin proxy |
| `tripsApi.getStats()` | `/admin/trips/stats` | GET | **PROXY** | Via admin proxy |
| `tripsApi.cancel()` | `/admin/trips/:id/cancel` | POST | **PROXY** | Via admin proxy |

### Admin Users Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `usersApi.getAll()` | `/admin/users` | GET | **PROXY** | Via admin proxy |
| `usersApi.getById()` | `/admin/users/:id` | GET | **PROXY** | Via admin proxy |
| `usersApi.getStats()` | `/admin/users/stats` | GET | **PROXY** | Via admin proxy |
| `usersApi.updateStatus()` | `/admin/users/:id/status` | PATCH | **PROXY** | Via admin proxy |
| `usersApi.getOnboardingStatus()` | `/auth/driver/:id/onboarding-status` | GET | **DIRECT** | Auth route |
| `usersApi.approveDriver()` | `/admin/users/:id/approve-driver` | PATCH | **PROXY** | Via admin proxy |
| `usersApi.rejectDocument()` | `/admin/users/:id/reject-document` | PATCH | **PROXY** | Via admin proxy |
| `usersApi.approveDocument()` | `/admin/users/:id/approve-document` | PATCH | **PROXY** | Via admin proxy |
| `usersApi.create()` | `/auth/admin/create-user` | POST | **DIRECT** | Auth route |
| `usersApi.resetUploadAttempts()` | `/admin/users/:id/reset-attempts` | PATCH | **PROXY** | Via admin proxy |

### Admin Wallets Endpoints

| Dashboard Call | Backend Endpoint | Method | Status | Notes |
|----------------|------------------|--------|--------|-------|
| `walletsApi.getByUser()` | `/admin/wallets/user/:userId` | GET | **PROXY** | Via admin proxy |
| `walletsApi.credit()` | `/admin/wallets/credit` | POST | **PROXY** | Via admin proxy |
| `walletsApi.debit()` | `/admin/wallets/debit` | POST | **PROXY** | Via admin proxy |
| `walletsApi.getWithdrawals()` | `/admin/withdrawals` | GET | **PROXY** | Via admin proxy |
| `walletsApi.processWithdrawal()` | `/admin/withdrawals/:id/process` | PATCH | **PROXY** | Via admin proxy |

---

## Architecture Pattern

The dashboard uses a **catch-all proxy pattern** for admin endpoints:

```tsx
// backend/apps/elysia/api-gateway/src/modules/admin/index.ts
export const admin = new Elysia({ prefix: '/admin' })
  .use(authGuard)
  .all('/*', async ({ request, accessToken, user, set, internalJwt }) => {
    // Proxy all /admin/* requests to Admin service
    const targetUrl = ADMIN_SERVICE_URL;
    const targetPath = path.replace('/admin', '') + url.search;
    
    // Generate internal service token
    const internalToken = await internalJwt.sign({
      service: 'api-gateway',
      internal: true,
      sub: user?.id || 'admin',
      role: user?.role || 'ADMIN',
    });
    
    // Proxy to Admin service
    const res = await AdminProxyService.proxyTo(targetUrl, method, targetPath, body, {
      'Authorization': `Bearer ${internalToken}`,
      'X-Admin-Token': String(accessToken),
    });
    
    return res.json();
  });
```

This means **all `/admin/*` endpoints are proxied** to the Admin service without explicit route definitions in the gateway.

---

## Issues Found

### HIGH DASH-BE-001: Admin Service Routes Not Verified

- **Dashboard Files**: All `dashboard/src/pages/*/services/api.ts`
- **Category**: integration
- **Impact**: 404s if Admin service routes missing

**Description**

The dashboard makes 30+ calls to `/admin/*` endpoints. These are proxied via a catch-all route to the Admin service. Need to verify the Admin service has corresponding routes.

**Dashboard Endpoints**:
- `/admin/complaints` (5 endpoints)
- `/admin/notifications` (8 endpoints)
- `/admin/profile` (4 endpoints)
- `/admin/promos` (4 endpoints)
- `/admin/settings` (4 endpoints)
- `/admin/trips` (4 endpoints)
- `/admin/users` (10 endpoints)
- `/admin/wallets` (5 endpoints)
- `/admin/withdrawals` (2 endpoints)

**Recommendation**

Verify Admin service has routes for all these endpoints. Create a similar cross-reference document for Admin service routes.

---

### MEDIUM DASH-BE-002: Mixed Routing Pattern

- **Dashboard Files**: `dashboard/src/pages/users/services/api.ts`, `dashboard/src/pages/login/services/api.ts`
- **Category**: code-quality
- **Impact**: Confusion, maintenance burden

**Description**

Some endpoints use direct routes instead of the admin proxy:

```tsx
// Direct to Auth service
usersApi.getOnboardingStatus() -> /auth/driver/:id/onboarding-status
usersApi.create() -> /auth/admin/create-user

// Via Admin proxy
usersApi.getAll() -> /admin/users
usersApi.updateStatus() -> /admin/users/:id/status
```

This mixing of patterns can cause confusion.

**Recommendation**

Standardize on one pattern:
- Option A: Move all admin operations through `/admin/*` proxy
- Option B: Document which routes go where and why

---

### MEDIUM DASH-BE-003: Missing Pagination Implementation

- **Dashboard Files**: `dashboard/src/pages/trips/services/api.ts`, `dashboard/src/pages/users/services/api.ts`
- **Category**: bug
- **Impact**: Performance issues with large datasets

**Description**

The API supports pagination parameters but the dashboard implementation may not use them correctly:

```tsx
export interface TripFilters {
  status?: string;
  riderId?: string;
  driverId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// But queries.ts doesn't pass these:
export const useGetTrips = (filters: TripFilters) => {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: () => tripsApi.getAll(filters),
    // Pagination params passed but not used in UI
  });
};
```

**Recommendation**

Implement proper pagination UI or remove unused parameters.

---

### LOW DASH-BE-004: MinIO Upload Bypasses API Gateway

- **Dashboard Files**: `dashboard/src/pages/profile/services/api.ts`
- **Category**: security
- **Impact**: Direct MinIO access

**Description**

Profile image upload bypasses the API gateway:

```tsx
uploadToMinIO: (url: string, file: File) =>
  fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  }),
```

The presigned URL is generated via the API, but the actual upload goes directly to MinIO. This is intentional for performance but should be documented.

**Recommendation**

Add comment explaining the pattern:
```tsx
// Upload directly to MinIO using presigned URL
// This bypasses API gateway for performance (large file uploads)
uploadToMinIO: (url: string, file: File) => ...
```

---

### LOW DASH-BE-005: Missing Error Response Types

- **Dashboard Files**: All API files
- **Category**: type-safety
- **Impact**: Untyped error responses

**Description**

API calls don't define error response types:

```tsx
getAll: (status?: string) =>
  api.get<ComplaintDTO[]>('/admin/complaints', { params: { status } }),
  // No error type defined
```

**Recommendation**

Add error types:
```tsx
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

getAll: (status?: string) =>
  api.get<ComplaintDTO[], ApiError>('/admin/complaints', { params: { status } }),
```

---

## Endpoint Coverage Summary

| Module | Dashboard Endpoints | Backend Proxy | Status |
|--------|---------------------|---------------|--------|
| Auth | 3 | Direct | Match |
| Complaints | 5 | `/admin/*` | Verify Admin service |
| Notifications | 8 | `/admin/*` | Verify Admin service |
| Profile | 4 | `/admin/*` | Verify Admin service |
| Promos | 4 | `/admin/*` | Verify Admin service |
| Settings | 4 | `/admin/*` | Verify Admin service |
| Trips | 4 | `/admin/*` | Verify Admin service |
| Users | 10 | Mixed | Verify both |
| Wallets | 5 | `/admin/*` | Verify Admin service |

**Total Endpoints**: 47
**Via Admin Proxy**: 44
**Direct Routes**: 3

---

## Recommendations Priority

1. **HIGH**: Verify Admin service has all required routes
2. **MEDIUM**: Standardize routing pattern (proxy vs direct)
3. **MEDIUM**: Implement pagination UI
4. **LOW**: Add error response types
5. **LOW**: Document MinIO upload pattern