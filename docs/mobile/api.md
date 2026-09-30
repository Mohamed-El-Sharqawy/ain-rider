# Mobile HTTP Client & API Modules Code Review

**Workspace**: mobile
**Domain**: api
**Date**: 2026-04-07
**Files Covered**: 9 API module files

## Summary

The API layer is well-organized with a central `ApiClient` handling authentication, token refresh, and multipart uploads. Each domain has its own module (auth, driver, trip, match, location, settings, support). However, there are several issues: missing request timeout, missing request cancellation, missing retry logic for network failures, inconsistent response type handling, missing request deduplication, and console.log statements in production code.

## Files Covered

| File | Status | Notes |
|------|--------|-------|
| `client.ts` | Issues found | Missing timeout, cancellation, retry |
| `types.ts` | Issues found | Inconsistent response shapes |
| `auth.ts` | Issues found | Missing error types |
| `driver.ts` | Issues found | Response type inconsistency |
| `trip.api.ts` | Issues found | Missing pagination support |
| `match.api.ts` | Issues found | Missing typed responses |
| `location.api.ts` | Clean | Simple location API |
| `settings.api.ts` | Issues found | Missing error handling |
| `support.api.ts` | Issues found | Missing pagination |

---

## HIGH FINDINGS

### HIGH MOB-API-001: Missing Request Timeout

- **File**: `mobile/lib/api/client.ts:25-50`
- **Category**: bug
- **Impact**: Requests hang indefinitely

**Description**

The `fetch` calls have no timeout. If the server is unresponsive, requests will hang until the OS kills them (often 60+ seconds on mobile).

```tsx
response = await fetch(url, { ...options, headers });
// No AbortController, no timeout
```

**Recommendation**

Add AbortController with timeout:
```tsx
const DEFAULT_TIMEOUT = 30000; // 30 seconds

async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    // ...
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### HIGH MOB-API-002: Missing Request Cancellation

- **File**: `mobile/lib/api/client.ts`
- **Category**: bug
- **Impact**: Wasted bandwidth, stale responses

**Description**

There's no mechanism to cancel in-flight requests. When a user navigates away from a screen, API requests continue and their responses may update stale state.

**Recommendation**

Add request cancellation support:
```tsx
// In client.ts
export const ApiClient = {
  createAbortController(): AbortController {
    return new AbortController();
  },

  async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    signal?: AbortSignal
  ): Promise<T> {
    // ...
    const response = await fetch(url, {
      ...options,
      headers,
      signal: signal || options.signal,
    });
    // ...
  },
};

// In hooks
useEffect(() => {
  const controller = new AbortController();
  
  (async () => {
    try {
      const data = await ApiClient.get('/trips', controller.signal);
      // ...
    } catch (error) {
      if (error.name !== 'AbortError') {
        // handle error
      }
    }
  })();
  
  return () => controller.abort();
}, []);
```

---

### HIGH MOB-API-003: Token Refresh Race Condition

- **File**: `mobile/lib/api/client.ts:50-100`
- **Category**: bug
- **Impact**: Multiple refresh requests, token thrashing

**Description**

While the code has a `refreshPromise` to deduplicate refresh requests, there's a race condition: if multiple requests fail with 401 simultaneously before `isRefreshing` is set, they all trigger refresh.

```tsx
if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
  // Multiple requests can reach here before isRefreshing is set
  try {
    const newToken = await this.refreshToken();
    // ...
  }
}
```

**Recommendation**

Use a mutex or ensure the flag is set synchronously:
```tsx
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

async refreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    // Wait for existing refresh
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  
  try {
    const newToken = await this.doRefresh();
    failedQueue.forEach(({ resolve }) => resolve(newToken));
    return newToken;
  } catch (error) {
    failedQueue.forEach(({ reject }) => reject(error));
    throw error;
  } finally {
    isRefreshing = false;
    failedQueue = [];
  }
}
```

---

### HIGH MOB-API-004: Missing Retry Logic for Network Failures

- **File**: `mobile/lib/api/client.ts:30-45`
- **Category**: bug
- **Impact**: Failed requests not retried

**Description**

Network failures (no internet, weak signal) immediately throw without retry. Mobile apps should retry transient failures.

```tsx
try {
  response = await fetch(url, { ...options, headers });
} catch (error) {
  console.error(`[ApiClient] Fetch Error for ${url}:`, error);
  throw error; // No retry
}
```

**Recommendation**

Add retry with exponential backoff:
```tsx
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async request<T>(endpoint: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<T> {
  try {
    const response = await fetch(url, { ...options, headers });
    // ...
  } catch (error) {
    if (retries > 0 && this.isRetryableError(error)) {
      await this.delay(RETRY_DELAY * (MAX_RETRIES - retries + 1));
      return this.request<T>(endpoint, options, retries - 1);
    }
    throw error;
  }
}

isRetryableError(error: any): boolean {
  return (
    error.name === 'TypeError' || // Network error
    error.message?.includes('Network request failed')
  );
}
```

---

## MEDIUM FINDINGS

### MEDIUM MOB-API-005: Inconsistent Response Type Handling

- **File**: `mobile/lib/api/auth.ts:70-75`, `mobile/lib/api/driver.ts:15-20`
- **Category**: bug
- **Impact**: Type confusion, runtime errors

**Description**

Multiple API methods handle wrapped/unwrapped responses inconsistently:

```tsx
// auth.ts
async getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const raw = await ApiClient.get<{ success?: boolean; data?: OnboardingStatusResponse } & OnboardingStatusResponse>('/auth/driver/onboarding-status');
  return raw.data ?? raw; // Sometimes wrapped, sometimes not
}

// driver.ts - same pattern
async getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const raw = await ApiClient.get<{ success?: boolean; data?: OnboardingStatusResponse } & OnboardingStatusResponse>('/auth/driver/onboarding-status');
  return raw.data ?? raw;
}
```

This is duplicated and the backend should have a consistent response shape.

**Recommendation**

Normalize responses in the client:
```tsx
// client.ts
async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // ...
  const data = await response.json();
  
  // Normalize wrapped responses
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return data.data as T;
  }
  
  return data as T;
}
```

---

### MEDIUM MOB-API-006: Missing Request Deduplication

- **File**: `mobile/lib/api/client.ts`
- **Category**: performance
- **Impact**: Duplicate requests, wasted bandwidth

**Description**

There's no deduplication for identical requests. If multiple components call the same endpoint simultaneously, multiple requests are made.

**Recommendation**

Add request deduplication for GET requests:
```tsx
const pendingRequests = new Map<string, Promise<any>>();

async get<T>(endpoint: string): Promise<T> {
  const cacheKey = `GET:${endpoint}`;
  
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey) as Promise<T>;
  }
  
  const promise = this.request<T>(endpoint, { method: 'GET' })
    .finally(() => pendingRequests.delete(cacheKey));
  
  pendingRequests.set(cacheKey, promise);
  return promise;
}
```

---

### MEDIUM MOB-API-007: Console.log Statements in Production Code

- **File**: `mobile/lib/api/client.ts:35-100`
- **Category**: code-quality
- **Impact**: Performance, security

**Description**

Multiple debug console.log statements are in the client:
```tsx
console.log(`[ApiClient] Request: ${options.method || 'GET'} ${url}`);
console.log(`[ApiClient] Response Status: ${response.status}`);
console.log(`[ApiClient] 401 detected, attempting to refresh token...`);
console.log(`[ApiClient] Token refresh successful`);
```

**Recommendation**

Remove or wrap in `__DEV__`:
```tsx
if (__DEV__) {
  console.log(`[ApiClient] Request: ${options.method || 'GET'} ${url}`);
}
```

---

### MEDIUM MOB-API-008: Trip API Missing Pagination Parameters

- **File**: `mobile/lib/api/trip.api.ts:45-50`
- **Category**: bug
- **Impact**: Performance degradation with many trips

**Description**

`getMyTrips` has no pagination support:
```tsx
async getMyTrips(): Promise<TripResponse[]> {
  return ApiClient.get<TripResponse[]>('/trips');
}
```

**Recommendation**

Add pagination:
```tsx
interface PaginationParams {
  cursor?: string;
  limit?: number;
  status?: string;
}

interface PaginatedTripsResponse {
  trips: TripResponse[];
  nextCursor?: string;
  hasMore: boolean;
}

async getMyTrips(params?: PaginationParams): Promise<PaginatedTripsResponse> {
  const query = new URLSearchParams();
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.status) query.set('status', params.status);
  
  return ApiClient.get<PaginatedTripsResponse>(`/trips?${query.toString()}`);
}
```

---

### MEDIUM MOB-API-009: Match API Returns Untyped Responses

- **File**: `mobile/lib/api/match.api.ts`
- **Category**: type-safety
- **Impact**: Type errors at runtime

**Description**

All MatchApi methods return `Promise<any>`:
```tsx
async registerAvailable(data: {...}): Promise<any> {
  return ApiClient.post<any>('/match/available', data);
}

async unregisterAvailable(): Promise<any> {
  return ApiClient.post<any>('/match/unavailable');
}

async respondToTrip(tripId: string, action: 'accept' | 'reject'): Promise<any> {
  return ApiClient.post<any>(`/match/respond`, { tripId, action });
}
```

**Recommendation**

Define proper types:
```tsx
interface RegisterAvailableResponse {
  success: boolean;
  h3Index: string;
  ttl: number;
}

interface RespondToTripResponse {
  success: boolean;
  tripId: string;
  status: string;
}

async registerAvailable(data: RegisterAvailablePayload): Promise<RegisterAvailableResponse> {
  return ApiClient.post<RegisterAvailableResponse>('/match/available', data);
}
```

---

### MEDIUM MOB-API-010: Support API Missing Pagination

- **File**: `mobile/lib/api/support.api.ts:50-55`
- **Category**: bug
- **Impact**: Performance with many complaints

**Description**

`getMyComplaints` returns all complaints without pagination:
```tsx
async getMyComplaints(): Promise<ComplaintResponse[]> {
  return ApiClient.get<ComplaintResponse[]>('/support/complaints');
}
```

**Recommendation**

Add pagination similar to MOB-API-008.

---

### MEDIUM MOB-API-011: Settings API JSON Parse Error Silently Caught

- **File**: `mobile/lib/api/settings.api.ts:30-45`
- **Category**: bug
- **Impact**: Silent failures, wrong data

**Description**

JSON parsing errors are caught and default values are returned, hiding potential issues:
```tsx
async getCancellationReasons(lang: 'en' | 'ar' = 'en'): Promise<string[]> {
  try {
    const setting = await this.getPublicSetting('cancellation_reasons');
    if (!setting || !setting.value) return this.getDefaultReasons(lang);
    
    const reasons = JSON.parse(setting.value);
    return reasons[lang] || reasons['en'] || this.getDefaultReasons(lang);
  } catch (err) {
    console.warn('[SettingsApi] Failed to parse cancellation reasons, using defaults:', err);
    return this.getDefaultReasons(lang);
  }
}
```

**Recommendation**

Validate the setting format:
```tsx
interface CancellationReasonsSetting {
  en: string[];
  ar?: string[];
}

function isValidReasonsSetting(value: unknown): value is CancellationReasonsSetting {
  return (
    typeof value === 'object' &&
    value !== null &&
    'en' in value &&
    Array.isArray((value as any).en)
  );
}

async getCancellationReasons(lang: 'en' | 'ar' = 'en'): Promise<string[]> {
  const setting = await this.getPublicSetting('cancellation_reasons');
  if (!setting?.value) {
    console.warn('[SettingsApi] No cancellation_reasons setting found');
    return this.getDefaultReasons(lang);
  }
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(setting.value);
  } catch (err) {
    console.error('[SettingsApi] Invalid JSON in cancellation_reasons:', err);
    return this.getDefaultReasons(lang);
  }
  
  if (!isValidReasonsSetting(parsed)) {
    console.error('[SettingsApi] Invalid cancellation_reasons format');
    return this.getDefaultReasons(lang);
  }
  
  return parsed[lang] || parsed.en;
}
```

---

## LOW FINDINGS

### LOW MOB-API-012: Missing Base URL Validation

- **File**: `mobile/lib/api/client.ts:3`
- **Category**: security
- **Impact**: Potential URL injection

**Description**

The base URL is taken from environment without validation:
```tsx
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
```

**Recommendation**

Validate URL format:
```tsx
const validateUrl = (url: string): string => {
  try {
    new URL(url);
    return url;
  } catch {
    console.error(`Invalid API URL: ${url}`);
    return 'http://localhost:3000';
  }
};

export const API_BASE_URL = validateUrl(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000');
```

---

### LOW MOB-API-013: Missing Response Validation

- **File**: `mobile/lib/api/client.ts:55-65`
- **Category**: type-safety
- **Impact**: Invalid data passed to components

**Description**

API responses are cast to types without runtime validation:
```tsx
return data as T;
```

**Recommendation**

Use Zod or io-ts for runtime validation:
```tsx
import { z } from 'zod';

const TripResponseSchema = z.object({
  id: z.string(),
  riderId: z.string(),
  status: z.string(),
  // ...
});

async getTrip(tripId: string): Promise<TripResponse> {
  const data = await ApiClient.get<unknown>(`/trips/${tripId}`);
  return TripResponseSchema.parse(data);
}
```

---

### LOW MOB-API-014: Missing DELETE Method in Client

- **File**: `mobile/lib/api/client.ts`
- **Category**: code-quality
- **Impact**: Incomplete API

**Description**

The client has GET, POST, PATCH but no DELETE method:
```tsx
async get<T>(endpoint: string): Promise<T>
async post<T>(endpoint: string, body?: any): Promise<T>
async patch<T>(endpoint: string, body?: any): Promise<T>
// Missing: delete
```

**Recommendation**

Add DELETE method:
```tsx
async delete<T>(endpoint: string): Promise<T> {
  return this.request<T>(endpoint, { method: 'DELETE' });
}
```

---

### LOW MOB-API-015: Duplicate getOnboardingStatus in AuthApi and DriverApi

- **File**: `mobile/lib/api/auth.ts:70-75`, `mobile/lib/api/driver.ts:15-20`
- **Category**: code-quality
- **Impact**: Confusion, maintenance burden

**Description**

Both `AuthApi` and `DriverApi` have identical `getOnboardingStatus` methods calling the same endpoint.

**Recommendation**

Keep only one, preferably in `DriverApi` since it's driver-specific:
```tsx
// Remove from auth.ts
// Keep in driver.ts
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| MOB-API-001 | MOB-S-003 (Error boundaries) |
| MOB-API-002 | MOB-S-011 (Search debounce) |
| MOB-API-003 | MOB-ST-002 (Onboarding race condition) |
| MOB-API-005 | MOB-ST-007 (Onboarding type safety) |
| MOB-API-008 | MOB-S-010 (Activity pagination) |
| MOB-API-009 | INT-BM-002 (Match service types) |