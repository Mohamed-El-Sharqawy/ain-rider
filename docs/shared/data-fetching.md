# Data Fetching Patterns Code Review

**Workspace**: mobile, dashboard
**Domain**: data-fetching
**Date**: 2026-04-07
**Files Covered**: Query hooks, mutations, API clients

## Summary

The dashboard uses TanStack Query with proper query key factories, cache invalidation, and optimistic updates. The mobile app uses direct API calls with Zustand for state management. Both approaches have trade-offs. The dashboard's approach is more robust but the mobile's approach is simpler for React Native. Key issues include missing cache invalidation, missing optimistic updates, race conditions in token refresh, and inconsistent error handling.

## Files Covered

### Dashboard

| File | Status | Notes |
|------|--------|-------|
| `api/client.ts` | Issues found | Token refresh race condition |
| `pages/login/services/queries.ts` | Clean | Good caching strategy |
| `pages/complaints/services/queries.ts` | Issues found | Missing pagination |
| `pages/complaints/services/mutations.ts` | Clean | Good invalidation |
| `pages/promos/services/mutations.ts` | Clean | Good invalidation |

### Mobile

| File | Status | Notes |
|------|--------|-------|
| `lib/api/client.ts` | Issues found | Token refresh race condition |
| `lib/api/*.ts` | Issues found | Missing caching |
| `hooks/useNearbyDrivers.ts` | Issues found | Manual polling |
| `stores/*.ts` | Issues found | No query caching |

---

## HIGH FINDINGS

### HIGH DATA-001: Token Refresh Race Condition (Both Platforms)

- **File**: `dashboard/src/api/client.ts:30-70`, `mobile/lib/api/client.ts:40-80`
- **Category**: bug
- **Impact**: Multiple refresh requests, auth failures

**Description**

Both platforms have the same token refresh race condition. When multiple requests fail with 401 simultaneously, they all try to refresh the token:

**Dashboard:**
```tsx
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  })
    .then(() => api(originalRequest))
    .catch((err) => Promise.reject(err));
}
```

**Mobile:**
```tsx
// No queue mechanism - multiple refresh calls possible
if (status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  const refreshed = await refreshTokens();
  // Other requests may also call refreshTokens()
}
```

**Recommendation**

Both platforms need proper singleton refresh lock:
```tsx
let refreshPromise: Promise<void> | null = null;

async function ensureValidToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = api.post('/auth/refresh').then(() => {
    refreshPromise = null;
  });
  
  return refreshPromise;
}

// In interceptor
if (status === 401 && !originalRequest._retry) {
  await ensureValidToken();
  return api(originalRequest);
}
```

---

### HIGH DATA-002: Mobile Missing Request Cancellation

- **File**: `mobile/lib/api/client.ts`
- **Category**: bug
- **Impact**: Stale data, memory leaks

**Description**

The mobile API client doesn't support request cancellation. When components unmount or users navigate away, requests continue:

```tsx
export async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  // No AbortController support
  const response = await fetch(url, {
    method: config.method,
    headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
  });
  // ...
}
```

**Recommendation**

Add AbortController support:
```tsx
interface RequestConfig {
  // ...
  signal?: AbortSignal;
}

export async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    signal: config.signal,
    // ...
  });
}

// Usage in components
useEffect(() => {
  const controller = new AbortController();
  
  TripApi.getTrips({ signal: controller.signal })
    .then(setTrips)
    .catch((err) => {
      if (err.name !== 'AbortError') {
        handleError(err);
      }
    });
  
  return () => controller.abort();
}, []);
```

---

### HIGH DATA-003: Mobile Missing Query Deduplication

- **File**: `mobile/lib/api/*.ts`, `mobile/hooks/useNearbyDrivers.ts`
- **Category**: performance
- **Impact**: Duplicate API calls

**Description**

The mobile app doesn't deduplicate identical requests. If multiple components need the same data, they each make separate API calls:

```tsx
// Component A
useEffect(() => {
  TripApi.getTrip(tripId).then(setTrip);
}, [tripId]);

// Component B (rendered simultaneously)
useEffect(() => {
  TripApi.getTrip(tripId).then(setTrip);
}, [tripId]);

// Two identical API calls
```

**Recommendation**

Add request deduplication:
```tsx
const pendingRequests = new Map<string, Promise<any>>();

export async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const key = `${config.method}:${config.endpoint}:${JSON.stringify(config.body)}`;
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = fetch(url, options)
    .then(processResponse)
    .finally(() => pendingRequests.delete(key));
  
  pendingRequests.set(key, promise);
  return promise;
}
```

---

## MEDIUM FINDINGS

### MEDIUM DATA-004: Dashboard Missing Pagination in Queries

- **File**: `dashboard/src/pages/*/services/queries.ts`
- **Category**: performance
- **Impact**: Memory issues with large datasets

**Description**

All queries fetch all records without pagination parameters:

```tsx
export const useGetComplaints = (status?: string) => {
  return useQuery({
    queryKey: complaintKeys.list(status),
    queryFn: () => complaintsApi.getAll(status).then((r) => r.data.map(transformComplaint)),
    // No cursor/limit parameters
  });
};
```

**Recommendation**

Add pagination:
```tsx
interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export const useGetComplaints = (params: PaginationParams & { status?: string }) => {
  return useQuery({
    queryKey: complaintKeys.list(params),
    queryFn: () => complaintsApi.getAll(params),
    // ...
  });
};

// Query key factory
export const complaintKeys = {
  list: (params?: PaginationParams & { status?: string }) => 
    ['complaints', 'list', params] as const,
};
```

---

### MEDIUM DATA-005: Mobile Manual Polling Instead of React Query

- **File**: `mobile/hooks/useNearbyDrivers.ts:25-45`
- **Category**: code-quality
- **Impact**: Reinventing the wheel

**Description**

The mobile app implements manual polling instead of using TanStack Query's built-in refetchInterval:

```tsx
useEffect(() => {
  pollInterval.current = setInterval(fetchNearby, 10000);
  return () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
    }
  };
}, [latitude, longitude, enabled]);
```

**Recommendation**

Use TanStack Query (if added to mobile):
```tsx
export function useNearbyDrivers(latitude?: number, longitude?: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ['nearbyDrivers', latitude, longitude],
    queryFn: () => MatchApi.getNearbyDrivers(latitude, longitude),
    enabled: enabled && !!latitude && !!longitude,
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
```

---

### MEDIUM DATA-006: Dashboard Missing Optimistic Updates

- **File**: `dashboard/src/pages/*/services/mutations.ts`
- **Category**: ux
- **Impact**: Slow perceived performance

**Description**

Mutations don't use optimistic updates. Users wait for server response before seeing changes:

```tsx
export const useUpdateComplaintStatus = () => {
  return useMutation({
    mutationFn: ({ id, data }) => complaintsApi.updateStatus(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.all });
      // No optimistic update
    },
  });
};
```

**Recommendation**

Add optimistic updates:
```tsx
export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => complaintsApi.updateStatus(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: complaintKeys.all });
      
      // Snapshot previous value
      const previousComplaints = queryClient.getQueryData(complaintKeys.list());
      
      // Optimistically update
      queryClient.setQueryData(complaintKeys.list(), (old: Complaint[]) =>
        old?.map((c) => c.id === id ? { ...c, ...data } : c)
      );
      
      return { previousComplaints };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      queryClient.setQueryData(complaintKeys.list(), context.previousComplaints);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: complaintKeys.all });
    },
  });
};
```

---

### MEDIUM DATA-007: Dashboard Query Keys Not Type-Safe

- **File**: `dashboard/src/pages/*/services/queries.ts`
- **Category**: type-safety
- **Impact**: Runtime errors

**Description**

Query keys use `as const` but aren't fully type-safe:

```tsx
export const complaintKeys = {
  all: ['complaints'] as const,
  list: (status?: string) => ['complaints', 'list', { status }] as const,
  detail: (id: string) => ['complaints', 'detail', id] as const,
};
```

If someone passes wrong parameters, TypeScript won't catch it.

**Recommendation**

Use typed query key factory:
```tsx
import { createQueryKeys } from '@lukemorales/query-key-factory';

export const complaintKeys = createQueryKeys('complaints', {
  list: (filters: { status?: ComplaintStatus }) => ({ queryKey: [{ filters }] }),
  detail: (id: string) => ({ queryKey: [{ id }] }),
});
```

---

### MEDIUM DATA-008: Mobile Missing Retry Logic

- **File**: `mobile/lib/api/client.ts`
- **Category**: bug
- **Impact**: Failed requests not retried

**Description**

The mobile API client has no retry logic for transient failures:

```tsx
export async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const response = await fetch(url, options);
  // No retry on network error or 5xx
  if (!response.ok) {
    throw new ApiError(status, await response.text());
  }
}
```

**Recommendation**

Add retry with exponential backoff:
```tsx
async function requestWithRetry<T>(
  config: RequestConfig,
  retries: number = 3
): Promise<ApiResponse<T>> {
  for (let i = 0; i < retries; i++) {
    try {
      return await request(config);
    } catch (error) {
      if (i === retries - 1) throw error;
      if (!isRetryable(error)) throw error;
      
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429;
  }
  return error instanceof TypeError; // Network error
}
```

---

### MEDIUM DATA-009: Dashboard Missing Stale-While-Revalidate

- **File**: `dashboard/src/pages/*/services/queries.ts`
- **Category**: performance
- **Impact**: Unnecessary loading states

**Description**

Queries use `placeholderData: keepPreviousData` but don't use stale-while-revalidate pattern effectively:

```tsx
export const useGetComplaints = (status?: string) => {
  return useQuery({
    queryKey: complaintKeys.list(status),
    queryFn: () => complaintsApi.getAll(status),
    placeholderData: keepPreviousData,
    // Missing: staleTime
  });
};
```

**Recommendation**

Add staleTime:
```tsx
export const useGetComplaints = (status?: string) => {
  return useQuery({
    queryKey: complaintKeys.list(status),
    queryFn: () => complaintsApi.getAll(status),
    placeholderData: keepPreviousData,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
};
```

---

## LOW FINDINGS

### LOW DATA-010: Mobile Missing Response Caching

- **File**: `mobile/lib/api/*.ts`
- **Category**: performance
- **Impact**: Repeated API calls for same data

**Description**

No caching layer for API responses. Every call hits the network.

**Recommendation**

Add simple cache:
```tsx
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30_000;

export async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const key = `${config.method}:${config.endpoint}`;
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const response = await fetch(url, options);
  const data = await processResponse(response);
  
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

---

### LOW DATA-011: Dashboard Missing Query Selectors

- **File**: `dashboard/src/pages/*/services/queries.ts`
- **Category**: performance
- **Impact**: Unnecessary re-renders

**Description**

Queries return full objects even when components only need specific fields:

```tsx
const { data: complaints } = useGetComplaints();
const pendingCount = complaints?.filter(c => c.status === 'PENDING').length;
// Component re-renders on any complaint change, not just pending count
```

**Recommendation**

Use selectors:
```tsx
export const usePendingComplaintsCount = () => {
  return useQuery({
    queryKey: complaintKeys.list(),
    queryFn: complaintsApi.getAll,
    select: (data) => data.filter(c => c.status === 'PENDING').length,
  });
};
```

---

### LOW DATA-012: Mobile Missing Background Refetch

- **File**: `mobile/app/_layout.tsx`
- **Category**: ux
- **Impact**: Stale data after app resume

**Description**

No automatic refetch when app comes to foreground:

```tsx
// Missing AppState listener for refetch
```

**Recommendation**

Add background refetch:
```tsx
import { AppState } from 'react-native';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      // Refetch critical data
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
    }
  });
  return () => subscription.remove();
}, []);
```

---

### LOW DATA-013: Dashboard Error Messages Not Localized

- **File**: `dashboard/src/api/client.ts:70-90`
- **Category**: i18n
- **Impact**: English error messages for Arabic users

**Description**

```tsx
export function getApiError(error: unknown): string {
  // ...
  return error.message ?? 'An unexpected error occurred';
}
```

**Recommendation**

Use i18n:
```tsx
import { t } from '@/lib/i18n';

export function getApiError(error: unknown): string {
  // ...
  return error.message ?? t('errors.unexpected');
}
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| DATA-001 | MOB-API-003 (Token refresh race) |
| DATA-002 | MOB-API-002 (Request cancellation) |
| DATA-003 | MOB-API-009 (Request deduplication) |
| DATA-004 | DASH-PG-004 (Pagination) |
| DATA-005 | MOB-HK-006 (Nearby drivers polling) |
| DATA-006 | DASH-PG-006 (Optimistic updates) |
| DATA-008 | MOB-API-004 (Retry logic) |
| DATA-010 | MOB-ST-003 (Store persistence) |
| DATA-012 | MOB-HK-002 (Location cleanup) |