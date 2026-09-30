# Mobile Navigation & Auth Flow Code Review

**Workspace**: mobile
**Domain**: navigation, auth
**Date**: 2026-04-07
**Files Covered**: Navigation layout, auth guard, routing logic

## Summary

The mobile app uses Expo Router's file-based routing with a complex auth guard in `_layout.tsx`. The navigation structure separates auth, rider, driver, and support flows. However, the auth guard has race conditions, the routing logic is overly complex, and there are potential infinite redirect loops.

## Files Covered

| File | Status | Notes |
|------|--------|-------|
| `app/_layout.tsx` | Issues found | Complex routing, race conditions |
| `app/(auth)/_layout.tsx` | Clean | Stack navigator |
| `app/(rider)/_layout.tsx` | Not reviewed | Tab navigator |
| `app/(driver)/_layout.tsx` | Not reviewed | Tab navigator |
| `hooks/useAuthCheck.ts` | Issues found | Missing userId, offline handling |

---

## HIGH FINDINGS

### HIGH MOB-NA-001: Root Layout Race Conditions in Auth Guard

- **File**: `mobile/app/_layout.tsx:60-130`
- **Category**: bug
- **Impact**: Incorrect routing, screen flicker, infinite loops

**Description**

The root layout has multiple useEffects that trigger navigation based on overlapping state dependencies. This creates race conditions where:

1. `onboardingStatus` is fetched asynchronously but routing decisions happen before it resolves
2. Multiple effects can trigger conflicting redirects
3. The `SplashScreen.hideAsync()` is called early, exposing users to rapid screen changes

```tsx
// Effect 1: Fetch onboarding status
useEffect(() => {
  if (isAuthenticated && role === 'DRIVER' && (isOnboarding || onboardingStatus === null)) {
    fetchOnboardingStatus();
  }
}, [isAuthenticated, role, isOnboarding, onboardingStatus]);

// Effect 2: Complex routing logic that depends on onboardingStatus
useEffect(() => {
  if (!isReady) return;
  SplashScreen.hideAsync();
  
  // Routing decisions that may run before fetchOnboardingStatus completes
  if (isAuthenticated && role === 'DRIVER' && (isOnboarding || (onboardingStatus && onboardingStatus !== 'APPROVED'))) {
    // Smart redirection logic...
  }
}, [isAuthenticated, isReady, role, isOnboarding, segments, onboardingStatus, documentsStatus]);
```

**Recommendation**

Consolidate into a single routing state machine:
```tsx
type AuthRouteState = 
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; role: UserRole; destination: string }
  | { status: 'onboarding'; step: string };

const [routeState, setRouteState] = useState<AuthRouteState>({ status: 'loading' });

// Single effect to determine route state
useEffect(() => {
  if (!isReady) return;
  
  const determineState = async (): Promise<AuthRouteState> => {
    if (!isAuthenticated) {
      return { status: 'unauthenticated' };
    }
    
    if (role === 'DRIVER') {
      // Fetch onboarding status if needed
      let status = onboardingStatus;
      if (status === null) {
        status = await fetchOnboardingStatus();
      }
      
      if (status !== 'APPROVED') {
        return { status: 'onboarding', step: getOnboardingStep(status, documentsStatus) };
      }
    }
    
    return { 
      status: 'authenticated', 
      role: role!,, 
      destination: role === 'DRIVER' ? '/(driver)/(tabs)/home' : '/(rider)/(tabs)/home'
    };
  };
  
  determineState().then(setRouteState);
}, [isReady, isAuthenticated, role, onboardingStatus]);

// Single effect to navigate
useEffect(() => {
  SplashScreen.hideAsync();
  
  switch (routeState.status) {
    case 'unauthenticated':
      router.replace('/(auth)/welcome');
      break;
    case 'authenticated':
      router.replace(routeState.destination);
      break;
    case 'onboarding':
      router.replace(`/(auth)/${routeState.step}`);
      break;
  }
}, [routeState]);
```

---

### HIGH MOB-NA-002: Potential Infinite Redirect Loop for Drivers

- **File**: `mobile/app/_layout.tsx:100-125`
- **Category**: bug
- **Impact**: App stuck in redirect loop

**Description**

The driver onboarding routing has multiple conditions that could conflict, causing an infinite loop:

```tsx
if (documentsStatus?.identity.status === 'REJECTED') {
  if (currentAuthStep !== 'driver-documents') {
    router.replace('/(auth)/driver-documents');
  }
} else if (documentsStatus?.drivingLicense.status === 'REJECTED') {
  if (currentAuthStep !== 'driver-documents') {
    router.replace('/(auth)/driver-documents');
  }
} else if (documentsStatus?.vehicle.status === 'REJECTED') {
  if (currentAuthStep !== 'vehicle-info') {
    router.replace('/(auth)/vehicle-info');
  }
} else if (onboardingStatus === 'UNDER_REVIEW') {
  if (currentAuthStep !== 'pending-approval') {
    router.replace('/(auth)/pending-approval');
  }
} else if (onboardingStatus === 'PENDING_DOCUMENTS') {
  // ...
}
```

If `documentsStatus` is `null` but `onboardingStatus` is `PENDING_DOCUMENTS`, and `storeVehicle` is missing, the code redirects to `vehicle-info`. But if the user then uploads vehicle info and the store updates, it could trigger another redirect before the backend confirms.

**Recommendation**

Add a debounce or flag to prevent rapid redirects:
```tsx
const lastRedirectRef = useRef<string | null>(null);
const REDIRECT_DEBOUNCE = 500; // ms

const safeRedirect = useCallback((path: string) => {
  const now = Date.now();
  if (lastRedirectRef.current === path && now - (lastRedirectRef.current?.time || 0) < REDIRECT_DEBOUNCE) {
    return; // Skip duplicate redirect
  }
  lastRedirectRef.current = path;
  router.replace(path);
}, []);
```

---

### HIGH MOB-NA-003: Missing Deep Link Handling

- **File**: `mobile/app/_layout.tsx`
- **Category**: edge-case
- **Impact**: Deep links bypass auth guard

**Description**

The layout doesn't handle deep links properly. If a user opens a deep link like `ainrider://trip/123` while unauthenticated, the auth guard may redirect them to login, losing the deep link destination.

**Recommendation**

Store deep link destination and redirect after auth:
```tsx
import * as Linking from 'expo-linking';

useEffect(() => {
  const handleDeepLink = ({ url }: { url: string }) => {
    const { path, queryParams } = Linking.parse(url);
    if (path && !isAuthenticated) {
      // Store for post-auth redirect
      AsyncStorage.setItem('pendingDeepLink', url);
    }
  };
  
  const subscription = Linking.addEventListener('url', handleDeepLink);
  return () => subscription.remove();
}, [isAuthenticated]);

// After authentication
useEffect(() => {
  if (isAuthenticated) {
    AsyncStorage.getItem('pendingDeepLink').then((url) => {
      if (url) {
        AsyncStorage.removeItem('pendingDeepLink');
        const { path } = Linking.parse(url);
        if (path) router.push(path as any);
      }
    });
  }
}, [isAuthenticated]);
```

---

## MEDIUM FINDINGS

### MEDIUM MOB-NA-004: Driver Status Set to Offline on Every App Start

- **File**: `mobile/app/_layout.tsx:45-50`
- **Category**: bug
- **Impact**: Driver appears offline after app restart

**Description**

The layout forces driver status to offline on every app start, even if they were online before:

```tsx
useEffect(() => {
  if (!isAuthenticated || role !== 'DRIVER') return;
  DriverApi.updateStatus(false).catch(() => {});
}, [isAuthenticated, role]);
```

This is problematic because:
1. If the driver was online and the app crashed, they should remain online
2. Background location tracking may still be running

**Recommendation**

Check current status before forcing offline:
```tsx
useEffect(() => {
  if (!isAuthenticated || role !== 'DRIVER') return;
  
  const syncStatus = async () => {
    try {
      const status = await DriverApi.getStatus();
      if (status.isOnline) {
        // Driver was online - don't force offline
        // Optionally prompt user
      } else {
        // Ensure offline state is synced
        await DriverApi.updateStatus(false);
      }
    } catch {
      // If we can't check, assume offline
      await DriverApi.updateStatus(false);
    }
  };
  
  syncStatus();
}, [isAuthenticated, role]);
```

---

### MEDIUM MOB-NA-005: Missing Notification Permission Request

- **File**: `mobile/app/_layout.tsx:50-60`
- **Category**: edge-case
- **Impact**: Notifications don't work

**Description**

Android notification channel is set up, but notification permissions are never requested on iOS:

```tsx
useEffect(() => {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('trip-alerts', {...});
  }
}, []);
// Missing: iOS permission request
```

**Recommendation**

Request notification permissions on both platforms:
```tsx
useEffect(() => {
  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    
    if (Platform.OS === 'android' && status === 'granted') {
      await Notifications.setNotificationChannelAsync('trip-alerts', {...});
    }
  };
  
  setupNotifications();
}, []);
```

---

### MEDIUM MOB-NA-006: Offline Screen Redirect Doesn't Retry Auth

- **File**: `mobile/app/offline.tsx`, `mobile/hooks/useAuthCheck.ts:30-40`
- **Category**: bug
- **Impact**: User stuck on offline screen

**Description**

When the user is offline and their access token is expired, they're redirected to the offline screen. But the "Retry" button just calls `router.replace('/')` which triggers the auth check again, which may fail again if still offline.

```tsx
// offline.tsx
<TouchableOpacity onPress={() => router.replace('/')}>
  <Text>Retry Connection</Text>
</TouchableOpacity>

// useAuthCheck.ts
if (!networkState.isConnected) {
  router.replace('/offline');
  // No token refresh attempted
}
```

**Recommendation**

The offline screen should check network before retrying:
```tsx
const handleRetry = async () => {
  const networkState = await NetInfo.fetch();
  if (networkState.isConnected) {
    router.replace('/');
  } else {
    Alert.alert('Still Offline', 'Please check your internet connection.');
  }
};
```

---

### MEDIUM MOB-NA-007: Console.log Statements in Layout

- **File**: `mobile/app/_layout.tsx:25-130`
- **Category**: code-quality
- **Impact**: Performance, noise

**Description**

Multiple debug console.log statements:
```tsx
console.log('[LayoutDebug] State:', {...});
console.log('[LayoutDebug] Skipping routing: waiting for driver status...');
console.log('[LayoutDebug] Onboarding required based on status:', onboardingStatus);
// ... many more
```

**Recommendation**

Remove or wrap in `__DEV__`.

---

## LOW FINDINGS

### LOW MOB-NA-008: Missing Tab Bar Configuration

- **File**: `mobile/app/(rider)/_layout.tsx`, `mobile/app/(driver)/_layout.tsx`
- **Category**: ux
- **Impact**: Inconsistent tab bar appearance

**Description**

Tab navigators should be reviewed for consistent configuration (icons, labels, badges).

---

### LOW MOB-NA-009: Splash Screen Hide May Be Too Early

- **File**: `mobile/app/_layout.tsx:70`
- **Category**: ux
- **Impact**: Flash of content before ready

**Description**

```tsx
SplashScreen.hideAsync();
// Called before routing decisions are complete
```

**Recommendation**

Hide splash screen only after route is determined:
```tsx
useEffect(() => {
  if (routeState.status === 'loading') return;
  SplashScreen.hideAsync();
}, [routeState]);
```

---

### LOW MOB-NA-010: Missing Rate Limiting for Auth Attempts

- **File**: `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/verify-otp.tsx`
- **Category**: security
- **Impact**: Brute force vulnerability

**Description**

No client-side rate limiting for login or OTP verification attempts.

**Recommendation**

Add client-side rate limiting:
```tsx
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60000; // 1 minute

const [attempts, setAttempts] = useState(0);
const [lockedUntil, setLockedUntil] = useState<number | null>(null);

const handleLogin = async () => {
  if (lockedUntil && Date.now() < lockedUntil) {
    Alert.alert('Too Many Attempts', 'Please wait before trying again.');
    return;
  }
  
  try {
    await AuthApi.login(email, password);
    setAttempts(0);
  } catch (error) {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_DURATION);
    }
  }
};
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| MOB-NA-001 | MOB-S-005 (Layout race conditions) |
| MOB-NA-002 | MOB-ST-002 (Onboarding race condition) |
| MOB-NA-003 | DASH-NA-001 (Dashboard deep links) |
| MOB-NA-004 | MOB-S-002 (Driver home cleanup) |
| MOB-NA-006 | MOB-HK-008 (Location fallback) |