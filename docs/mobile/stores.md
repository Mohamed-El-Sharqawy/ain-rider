# Mobile Zustand Stores Code Review

**Workspace**: mobile
**Domain**: stores
**Date**: 2026-04-07
**Files Covered**: 5 Zustand stores

## Summary

The Zustand stores are well-structured with clear type definitions and simple state management. However, there are several issues: missing persistence for critical state, missing loading/error states for async operations, potential race conditions in async actions, missing selectors for performance optimization, and incomplete reset logic.

## Files Covered

| File | Status | Notes |
|------|--------|-------|
| `auth.store.ts` | Issues found | Missing loading state, error handling |
| `driver.store.ts` | Issues found | Missing persistence, incomplete state |
| `location.store.ts` | Clean | Simple location state |
| `onboarding.store.ts` | Issues found | Missing loading state, race condition |
| `trip.store.ts` | Issues found | Missing persistence, type issues |

---

## HIGH FINDINGS

### HIGH MOB-ST-001: Auth Store Missing Loading State for Async Operations

- **File**: `mobile/stores/auth.store.ts:20-35`
- **Category**: bug
- **Impact**: UI cannot show loading state during auth operations

**Description**

The `registerUser` and `logout` actions are async but the store has no loading state. Components cannot display loading indicators during these operations.

```tsx
export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  role: null,
  userId: null,
  isOnboarding: false,
  // No isLoading state
  
  registerUser: async (data: RegisterPayload) => {
    // No loading state set
    const res = await AuthApi.register(data);
    // ...
  },
  
  logout: async () => {
    // No loading state set
    await SecureStorage.clearTokens();
    set({ isAuthenticated: false, role: null, userId: null, isOnboarding: false });
  },
}));
```

**Recommendation**

Add loading and error states:
```tsx
interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  userId: string | null;
  isOnboarding: boolean;
  isLoading: boolean;
  error: string | null;
  // ...
}

export const useAuthStore = create<AuthState>((set) => ({
  // ...
  isLoading: false,
  error: null,
  
  registerUser: async (data: RegisterPayload) => {
    set({ isLoading: true, error: null });
    try {
      const res = await AuthApi.register(data);
      if (res.success) {
        await SecureStorage.saveTokens(res.accessToken, res.refreshToken);
        set({ 
          isAuthenticated: true, 
          role: res.user.role, 
          userId: res.user.id, 
          isOnboarding: true,
          isLoading: false 
        });
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },
}));
```

---

### HIGH MOB-ST-002: Onboarding Store Race Condition in fetchOnboardingStatus

- **File**: `mobile/stores/onboarding.store.ts:45-60`
- **Category**: bug
- **Impact**: Stale state on rapid calls

**Description**

The `fetchOnboardingStatus` function can be called multiple times rapidly (e.g., from multiple useEffects). There's no deduplication or cancellation, which can cause race conditions where an older response overwrites a newer one.

```tsx
fetchOnboardingStatus: async () => {
  console.log('[OnboardingDebug] Fetching status...');
  try {
    const res: any = await AuthApi.getOnboardingStatus();
    // If another call started after this one but finished before,
    // this will overwrite the newer state
    set({ 
      onboardingStatus: statusData.onboardingStatus,
      // ...
    });
  } catch (error) {
    console.error('[OnboardingDebug] Failed to fetch onboarding status:', error);
  }
},
```

**Recommendation**

Add request tracking:
```tsx
let fetchPromise: Promise<void> | null = null;

fetchOnboardingStatus: async () => {
  // Deduplicate concurrent calls
  if (fetchPromise) return fetchPromise;
  
  fetchPromise = (async () => {
    try {
      const res = await AuthApi.getOnboardingStatus();
      set({ /* ... */ });
    } finally {
      fetchPromise = null;
    }
  })();
  
  return fetchPromise;
},
```

---

### HIGH MOB-ST-003: Trip Store Missing Persistence

- **File**: `mobile/stores/trip.store.ts`
- **Category**: bug
- **Impact**: Trip state lost on app restart

**Description**

The trip store holds critical state for active trips (`activeTrip`, `driver`, `phase`). If the app crashes or is killed by the OS, this state is lost. When the user reopens the app, they won't see their active trip.

```tsx
const initialState = {
  phase: 'idle' as TripPhase,
  selectedPickup: null,
  selectedDropoff: null,
  route: null,
  fareEstimate: null,
  activeTrip: null,
  driver: null,
};
```

**Recommendation**

Persist critical state to AsyncStorage:
```tsx
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      // ... state and actions
    }),
    {
      name: 'trip-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeTrip: state.activeTrip,
        phase: state.phase,
        driver: state.driver,
      }),
    }
  )
);
```

---

### HIGH MOB-ST-004: Auth Store Missing Error State Propagation

- **File**: `mobile/stores/auth.store.ts:25-35`
- **Category**: bug
- **Impact**: Errors silently swallowed

**Description**

The `registerUser` function throws an error on failure, but there's no error state in the store. Components must catch the error themselves, leading to inconsistent error handling.

```tsx
registerUser: async (data: RegisterPayload) => {
  const res = await AuthApi.register(data);
  if (res.success) {
    // ...
  } else {
    throw new Error('Registration failed');
  }
},
```

**Recommendation**

Store error state and provide clear error messages:
```tsx
interface AuthState {
  // ...
  error: string | null;
  clearError: () => void;
}

registerUser: async (data: RegisterPayload) => {
  set({ isLoading: true, error: null });
  try {
    const res = await AuthApi.register(data);
    if (res.success) {
      await SecureStorage.saveTokens(res.accessToken, res.refreshToken);
      set({ 
        isAuthenticated: true, 
        role: res.user.role, 
        userId: res.user.id, 
        isOnboarding: true,
        isLoading: false 
      });
    } else {
      throw new Error(res.message || 'Registration failed');
    }
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Registration failed';
    set({ isLoading: false, error: message });
    throw error;
  }
},
```

---

## MEDIUM FINDINGS

### MEDIUM MOB-ST-005: Driver Store Missing Online Status Persistence

- **File**: `mobile/stores/driver.store.ts`
- **Category**: bug
- **Impact**: Driver appears offline after app restart

**Description**

The `isOnline` state is not persisted. If the app restarts while a driver is online, they'll appear offline even though they may still be registered with the match service.

```tsx
const initialState = {
  isOnline: false,
  currentTrip: null,
  riderLocation: null,
  tripRoute: null,
};
```

**Recommendation**

Persist online state and sync with backend on app start:
```tsx
// In app initialization
useEffect(() => {
  const syncOnlineStatus = async () => {
    const wasOnline = await AsyncStorage.getItem('driver_was_online');
    if (wasOnline === 'true') {
      // Check with backend if still registered
      const status = await DriverApi.getStatus();
      if (status.isRegistered) {
        driverStore.setOnline(true);
      } else {
        await AsyncStorage.setItem('driver_was_online', 'false');
      }
    }
  };
  syncOnlineStatus();
}, []);
```

---

### MEDIUM MOB-ST-006: Missing Selectors for Derived State

- **File**: `mobile/stores/trip.store.ts`
- **Category**: performance
- **Impact**: Unnecessary re-renders

**Description**

Components that only need specific parts of the trip state will re-render when any part changes. For example, a component showing just the driver name will re-render when the route changes.

```tsx
// In a component
const driver = useTripStore((state) => state.driver);
// This component re-renders when ANY part of store changes
// because Zustand uses shallow equality by default
```

**Recommendation**

Create memoized selectors:
```tsx
// stores/selectors/trip.selectors.ts
import { shallow } from 'zustand/shallow';

export const useDriverInfo = () => useTripStore(
  (state) => state.driver ? {
    name: state.driver.name,
    phone: state.driver.phone,
    rating: state.driver.rating,
  } : null,
  shallow
);

export const useTripPhase = () => useTripStore((state) => state.phase);

export const useActiveTripId = () => useTripStore((state) => state.activeTrip?.tripId);
```

---

### MEDIUM MOB-ST-007: Onboarding Store Type Safety Issue

- **File**: `mobile/stores/onboarding.store.ts:50-55`
- **Category**: type-safety
- **Impact**: Runtime errors possible

**Description**

The API response is typed as `any`, bypassing TypeScript's type checking:

```tsx
const res: any = await AuthApi.getOnboardingStatus();
const statusData = res.data || res; // Handle wrapped or unwrapped response
```

This is a workaround for inconsistent API response shapes, but it removes type safety.

**Recommendation**

Define proper types and normalize the response:
```tsx
interface OnboardingStatusResponse {
  onboardingStatus: 'PENDING_DOCUMENTS' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  documents: {
    identity: { status: string; rejectionReason?: string };
    drivingLicense: { status: string; rejectionReason?: string };
    vehicle: { status: string; rejectionReason?: string; details?: VehicleInfo };
  };
}

// In the API module, normalize the response
async getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const res = await this.client.get('/auth/onboarding/status');
  return res.data?.data ?? res.data; // Normalize at API level
}

// In store
const res = await AuthApi.getOnboardingStatus(); // Properly typed
```

---

### MEDIUM MOB-ST-008: Location Store Missing Error State

- **File**: `mobile/stores/location.store.ts`
- **Category**: edge-case
- **Impact**: Cannot handle location permission denial

**Description**

The location store has `permissionGranted` but no error state for when location fails (e.g., GPS unavailable, permission denied).

```tsx
interface LocationState {
  currentLocation: LatLng | null;
  heading: number | null;
  speed: number | null;
  isTracking: boolean;
  permissionGranted: boolean;
  // No error state
}
```

**Recommendation**

Add error state:
```tsx
interface LocationState {
  // ...
  error: 'PERMISSION_DENIED' | 'LOCATION_UNAVAILABLE' | 'TIMEOUT' | null;
  setError: (error: LocationState['error']) => void;
}
```

---

### MEDIUM MOB-ST-009: Trip Store Phase Transition Not Validated

- **File**: `mobile/stores/trip.store.ts:45-50`
- **Category**: bug
- **Impact**: Invalid state transitions possible

**Description**

The `setPhase` function accepts any phase without validating transitions. Invalid transitions like `idle` -> `matched` or `completed` -> `matching` are possible.

```tsx
setPhase: (phase) => set({ phase }),
```

**Recommendation**

Validate phase transitions:
```tsx
const VALID_TRANSITIONS: Record<TripPhase, TripPhase[]> = {
  idle: ['searching_destination'],
  searching_destination: ['idle', 'confirming'],
  confirming: ['idle', 'requesting', 'searching_destination'],
  requesting: ['matching', 'idle'],
  matching: ['matched', 'idle'],
  matched: ['driver_arriving', 'idle'],
  driver_arriving: ['in_progress', 'idle'],
  in_progress: ['completed'],
  completed: ['rating', 'idle'],
  rating: ['idle'],
};

setPhase: (phase) => set((state) => {
  if (!VALID_TRANSITIONS[state.phase].includes(phase)) {
    console.warn(`Invalid phase transition: ${state.phase} -> ${phase}`);
    return state; // No change
  }
  return { phase };
}),
```

---

## LOW FINDINGS

### LOW MOB-ST-010: Missing Devtools Integration

- **File**: All store files
- **Category**: code-quality
- **Impact**: Harder debugging

**Description**

Stores don't use Zustand's devtools middleware, making debugging harder in development.

**Recommendation**

```tsx
import { devtools } from 'zustand/middleware';

export const useTripStore = create<TripState>()(
  devtools(
    (set) => ({ /* ... */ }),
    { name: 'TripStore' }
  )
);
```

---

### LOW MOB-ST-011: Console.log in Onboarding Store

- **File**: `mobile/stores/onboarding.store.ts:45-60`
- **Category**: code-quality
- **Impact**: Performance, noise in production

**Description**

Debug console.log statements are left in the store:
```tsx
console.log('[OnboardingDebug] Fetching status...');
console.log('[OnboardingDebug] Received status:', res);
console.error('[OnboardingDebug] Failed to fetch onboarding status:', error);
```

**Recommendation**

Remove or wrap in `__DEV__`:
```tsx
if (__DEV__) {
  console.log('[OnboardingDebug] Fetching status...');
}
```

---

### LOW MOB-ST-012: Driver Store Missing Trip Duration Tracking

- **File**: `mobile/stores/driver.store.ts`
- **Category**: edge-case
- **Impact**: Missing trip metadata

**Description**

The `CurrentDriverTrip` interface lacks trip duration and fare information that would be useful for the driver.

```tsx
interface CurrentDriverTrip {
  tripId: string;
  riderId: string;
  pickupLocation: LatLng;
  dropoffLocation: LatLng;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  // Missing: estimatedDuration, estimatedFare, riderName, riderPhone
}
```

**Recommendation**

Add useful fields:
```tsx
interface CurrentDriverTrip {
  // ... existing fields
  estimatedDuration: number;
  estimatedFare: number;
  riderName: string;
  riderPhone: string;
}
```

---

### LOW MOB-ST-013: Auth Store Missing Token Refresh State

- **File**: `mobile/stores/auth.store.ts`
- **Category**: edge-case
- **Impact**: Cannot handle token refresh failures

**Description**

The auth store doesn't track token refresh state. If a refresh fails, there's no way to trigger a re-login prompt from the store.

**Recommendation**

Add token state:
```tsx
interface AuthState {
  // ...
  tokenExpiry: number | null;
  isRefreshing: boolean;
  setTokenExpiry: (expiry: number) => void;
}
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| MOB-ST-001 | MOB-S-003 (Error boundaries) |
| MOB-ST-002 | MOB-S-005 (Layout race conditions) |
| MOB-ST-003 | MOB-S-002 (Driver home cleanup) |
| MOB-ST-005 | MOB-S-002 (Driver home cleanup) |
| MOB-ST-007 | MOB-API-001 (API type safety) |
| MOB-ST-009 | MOB-S-001 (Trip screen state) |