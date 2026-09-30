# Mobile API Calls vs Backend Endpoints Cross-Reference

**Workspace**: mobile, backend
**Domain**: api, integration
**Date**: 2026-04-07

## Summary

This document cross-references all mobile API calls against backend API Gateway endpoints to identify mismatches, missing endpoints, and integration issues.

## Endpoint Mapping

### Auth Endpoints

| Mobile Call | Backend Endpoint | Method | Status | Notes |
|-------------|------------------|--------|--------|-------|
| `AuthApi.login()` | `/auth/login` | POST | Match | Token handling correct |
| `AuthApi.register()` | `/auth/register` | POST | Match | Token handling correct |
| `AuthApi.requestOtp()` | `/auth/request-otp` | POST | Match | Rate limited (15/min) |
| `AuthApi.verifyOtp()` | `/auth/verify-otp` | POST | Match | Returns tokens |
| `AuthApi.getProfile()` | `/auth/me` | GET | Match | Bearer or cookie auth |
| `AuthApi.refreshToken()` | `/auth/refresh` | POST | Match | Cookie + Bearer support |
| `AuthApi.uploadProfileImage()` | `/auth/rider/profile-image` | POST | Match | Multipart |
| `AuthApi.uploadIdentityDocument()` | `/auth/rider/documents/identity` | POST | Match | Multipart |
| `AuthApi.getOnboardingStatus()` | `/auth/driver/onboarding-status` | GET | Match | Bearer or cookie |
| `AuthApi.updateProfile()` | `/auth/driver/profile` | PATCH | Match | JSON body |
| `AuthApi.updateStatus()` | `/auth/driver/status` | PATCH | Match | JSON body |
| `AuthApi.uploadIdentityDocument()` | `/auth/driver/documents/identity` | POST | Match | Multipart |
| `AuthApi.uploadDrivingLicense()` | `/auth/driver/documents/driving-license` | POST | Match | Multipart |
| `AuthApi.registerVehicle()` | `/auth/driver/vehicle` | POST | Match | Multipart |

### Trip Endpoints

| Mobile Call | Backend Endpoint | Method | Status | Notes |
|-------------|------------------|--------|--------|-------|
| `TripApi.createTrip()` | `/trips` | POST | **CHECK** | Need to verify gateway route |
| `TripApi.getTrip()` | `/trips/:id` | GET | **CHECK** | Need to verify gateway route |
| `TripApi.cancelTrip()` | `/trips/:id/cancel` | POST | **CHECK** | Need to verify gateway route |
| `TripApi.rateTrip()` | `/trips/:id/rate` | POST | **CHECK** | Need to verify gateway route |
| `TripApi.estimateFare()` | `/trips/estimate-fare` | POST | **CHECK** | Need to verify gateway route |
| `TripApi.getUserTrips()` | `/trips/user` | GET | **CHECK** | Need to verify gateway route |
| `TripApi.updateStatus()` | `/trips/:id/status` | PATCH | **CHECK** | Driver only |
| `TripApi.rejectTrip()` | `/trips/:id/reject` | POST | **CHECK** | Driver only |
| `TripApi.acceptTrip()` | `/trips/:id/accept` | POST | **CHECK** | Driver only |

### Match Endpoints

| Mobile Call | Backend Endpoint | Method | Status | Notes |
|-------------|------------------|--------|--------|-------|
| `MatchApi.registerAvailable()` | `/match/available` | POST | Match | Driver only, auth required |
| `MatchApi.unregisterAvailable()` | `/match/unavailable` | POST | Match | Driver only |
| `MatchApi.respondToTrip()` | `/match/respond` | POST | Match | Body: {tripId, action} |
| `MatchApi.getNearbyDrivers()` | `/match/nearby` | GET | Match | Query params: lat, lng |

### Location Endpoints

| Mobile Call | Backend Endpoint | Method | Status | Notes |
|-------------|------------------|--------|--------|-------|
| `LocationApi.getNearbyDrivers()` | `/location/nearby` | GET | Match | Query params: lat, lng |
| `LocationApi.updateDriverLocation()` | `/location/update` | POST | Match | Driver only, auth required |

### Settings Endpoints

| Mobile Call | Backend Endpoint | Method | Status | Notes |
|-------------|------------------|--------|--------|-------|
| `SettingsApi.getPublicSettings()` | `/settings/public` | GET | **MISSING** | No gateway route found |
| `SettingsApi.getSetting()` | `/settings/:key` | GET | **MISSING** | No gateway route found |
| `SettingsApi.getCancellationReasons()` | `/settings/cancellation-reasons` | GET | **MISSING** | No gateway route found |

### Support Endpoints

| Mobile Call | Backend Endpoint | Method | Status | Notes |
|-------------|------------------|--------|--------|-------|
| `SupportApi.getComplaints()` | `/support/complaints` | GET | **MISSING** | No gateway route found |
| `SupportApi.getComplaint()` | `/support/complaints/:id` | GET | **MISSING** | No gateway route found |
| `SupportApi.createComplaint()` | `/support/complaints` | POST | **MISSING** | No gateway route found |
| `SupportApi.addComment()` | `/support/complaints/:id/comments` | POST | **MISSING** | No gateway route found |

---

## Issues Found

### CRITICAL MOB-BE-001: Missing Settings Gateway Routes

- **Mobile Files**: `mobile/lib/api/settings.api.ts`
- **Category**: integration
- **Impact**: Settings API calls will 404

**Description**

The mobile app has a SettingsApi module with three endpoints, but no corresponding routes exist in the API Gateway:

```tsx
// mobile/lib/api/settings.api.ts
async getPublicSettings(): Promise<PublicSettings> {
  return this.request({ endpoint: '/settings/public', method: 'GET' });
}

async getSetting(key: string): Promise<string | null> {
  return this.request({ endpoint: `/settings/${key}`, method: 'GET' });
}

async getCancellationReasons(): Promise<CancellationReason[]> {
  return this.request({ endpoint: '/settings/cancellation-reasons', method: 'GET' });
}
```

**Backend Status**: No `/settings` routes found in API Gateway.

**Recommendation**

Add settings routes to API Gateway:
```tsx
// backend/apps/elysia/api-gateway/src/modules/settings/index.ts
export const settingsProxy = new Elysia({ prefix: '/settings' })
  .get('/public', async ({ set }) => {
    const res = await SettingsProxyService.getPublicSettings();
    // ...
  })
  .get('/:key', async ({ params: { key }, set }) => {
    const res = await SettingsProxyService.getSetting(key);
    // ...
  })
  .get('/cancellation-reasons', async ({ set }) => {
    const res = await SettingsProxyService.getCancellationReasons();
    // ...
  });
```

---

### CRITICAL MOB-BE-002: Missing Support Gateway Routes

- **Mobile Files**: `mobile/lib/api/support.api.ts`
- **Category**: integration
- **Impact**: Support/complaints API calls will 404

**Description**

The mobile app has a SupportApi module with four endpoints, but no corresponding routes exist in the API Gateway:

```tsx
// mobile/lib/api/support.api.ts
async getComplaints(): Promise<Complaint[]> {
  return this.request({ endpoint: '/support/complaints', method: 'GET' });
}

async getComplaint(id: string): Promise<Complaint> {
  return this.request({ endpoint: `/support/complaints/${id}`, method: 'GET' });
}

async createComplaint(data: CreateComplaintData): Promise<Complaint> {
  return this.request({ endpoint: '/support/complaints', method: 'POST', body: data });
}

async addComment(complaintId: string, comment: string): Promise<void> {
  return this.request({ 
    endpoint: `/support/complaints/${complaintId}/comments`, 
    method: 'POST', 
    body: { comment } 
  });
}
```

**Backend Status**: No `/support` routes found in API Gateway.

**Recommendation**

Add support routes to API Gateway:
```tsx
// backend/apps/elysia/api-gateway/src/modules/support/index.ts
export const supportProxy = new Elysia({ prefix: '/support' })
  .use(authGuard)
  .get('/complaints', async ({ user, set }) => {
    const res = await SupportProxyService.getComplaints(user.id);
    // ...
  })
  .get('/complaints/:id', async ({ params: { id }, user, set }) => {
    const res = await SupportProxyService.getComplaint(id, user.id);
    // ...
  })
  .post('/complaints', async ({ body, user, set }) => {
    const res = await SupportProxyService.createComplaint(user.id, body);
    // ...
  })
  .post('/complaints/:id/comments', async ({ params: { id }, body, user, set }) => {
    const res = await SupportProxyService.addComment(id, user.id, body);
    // ...
  });
```

---

### HIGH MOB-BE-003: Trip Routes Need Verification

- **Mobile Files**: `mobile/lib/api/trip.api.ts`
- **Category**: integration
- **Impact**: Possible 404s on trip operations

**Description**

The mobile app has extensive trip endpoints. Need to verify these exist in the API Gateway. The trip module directory was not found at expected path.

**Mobile Endpoints**:
- `POST /trips` - Create trip
- `GET /trips/:id` - Get trip details
- `POST /trips/:id/cancel` - Cancel trip
- `POST /trips/:id/rate` - Rate trip
- `POST /trips/estimate-fare` - Estimate fare
- `GET /trips/user` - Get user trips
- `PATCH /trips/:id/status` - Update status (driver)
- `POST /trips/:id/reject` - Reject trip (driver)
- `POST /trips/:id/accept` - Accept trip (driver)

**Recommendation**

Verify trip routes exist in API Gateway and match mobile expectations.

---

### MEDIUM MOB-BE-004: Auth Token Handling Inconsistency

- **Mobile Files**: `mobile/lib/api/client.ts`
- **Backend Files**: `backend/apps/elysia/api-gateway/src/modules/auth/index.ts`
- **Category**: integration
- **Impact**: Potential auth failures

**Description**

Mobile sends `x-client-type: mobile` header to receive tokens in response body. Backend correctly handles this:

**Backend**:
```tsx
if (isMobileClient(request.headers)) {
  responseBody.accessToken = data.accessToken;
  responseBody.refreshToken = data.refreshToken;
}
```

**Mobile**:
```tsx
headers.set('x-client-type', 'mobile');
```

This is correctly implemented.

---

### MEDIUM MOB-BE-005: Match Respond Endpoint Changed

- **Mobile Files**: `mobile/lib/api/match.api.ts`
- **Backend Files**: `backend/apps/elysia/api-gateway/src/modules/match/index.ts`
- **Category**: integration
- **Impact**: Fixed in previous session

**Description**

Previously, mobile used `POST /match/respond/:tripId` with action in body. Now correctly uses:

**Mobile**:
```tsx
async respondToTrip(tripId: string, action: 'accept' | 'reject'): Promise<any> {
  return this.request({
    endpoint: '/match/respond',
    method: 'POST',
    body: { tripId, action },
  });
}
```

**Backend**:
```tsx
.post('/respond', async ({ body, user, set }) => {
  // ...
}, {
  body: t.Object({ tripId: t.String(), action: t.String() }),
})
```

This is now correctly aligned.

---

### MEDIUM MOB-BE-006: Location Nearby vs Match Nearby Duplication

- **Mobile Files**: `mobile/lib/api/location.api.ts`, `mobile/lib/api/match.api.ts`
- **Backend Files**: Multiple endpoints
- **Category**: code-quality
- **Impact**: Confusion, potential inconsistency

**Description**

Both LocationApi and MatchApi have `getNearbyDrivers` endpoints:

**LocationApi**:
```tsx
async getNearbyDrivers(latitude: number, longitude: number): Promise<any> {
  return this.request({
    endpoint: `/location/nearby?latitude=${latitude}&longitude=${longitude}`,
    method: 'GET',
  });
}
```

**MatchApi**:
```tsx
async getNearbyDrivers(latitude: number, longitude: number): Promise<any> {
  return this.request({
    endpoint: `/match/nearby?latitude=${latitude}&longitude=${longitude}`,
    method: 'GET',
  });
}
```

**Backend**:
- `/location/nearby` - No auth required
- `/match/nearby` - Auth required

**Recommendation**

Clarify which endpoint should be used for which purpose:
- `/location/nearby` - Public, for rider map display
- `/match/nearby` - Authenticated, for driver matching

Document this distinction in code comments.

---

## Endpoint Coverage Summary

| Module | Mobile Endpoints | Backend Endpoints | Match | Missing |
|--------|------------------|-------------------|-------|---------|
| Auth | 15 | 15 | 100% | 0 |
| Trip | 9 | ? | ? | Verify |
| Match | 4 | 4 | 100% | 0 |
| Location | 2 | 2 | 100% | 0 |
| Settings | 3 | 0 | 0% | 3 |
| Support | 4 | 0 | 0% | 4 |

**Total Missing**: 7 endpoints (Settings: 3, Support: 4)

---

## Recommendations Priority

1. **CRITICAL**: Add Settings and Support gateway routes
2. **HIGH**: Verify Trip routes exist and match
3. **MEDIUM**: Document Location vs Match nearby distinction
4. **LOW**: Add integration tests for all endpoints