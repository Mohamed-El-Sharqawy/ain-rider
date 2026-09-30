# Mobile Screens Code Review

**Workspace**: mobile
**Domain**: screens
**Date**: 2026-04-07
**Files Covered**: 22 screens across auth, rider, driver, and support flows

## Summary

The mobile app screens are well-structured using Expo Router with proper file-based routing. The UI follows a consistent dark theme with Tailwind/NativeWind styling. However, there are several issues: missing error boundaries at the screen level, inconsistent loading state handling, missing form validation feedback, hardcoded localhost URLs, missing RTL support, and potential memory leaks in location/WebSocket subscriptions.

## Files Covered

| File | Status | Notes |
|------|--------|-------|
| `(auth)/login.tsx` | Issues found | Missing rate limiting, hardcoded error messages |
| `(auth)/phone.tsx` | Issues found | Missing phone format validation |
| `(auth)/verify-otp.tsx` | Issues found | OTP expiry edge case |
| `(auth)/role-selection.tsx` | Clean | Simple role selection |
| `(auth)/welcome.tsx` | Clean | Onboarding carousel |
| `(auth)/basic-info.tsx` | Issues found | Missing email validation, weak password check |
| `(auth)/documents.tsx` | Issues found | Missing file size validation |
| `(auth)/driver-documents.tsx` | Issues found | Complex state, missing retry logic |
| `(auth)/driver-profile-extra.tsx` | Issues found | Missing date format validation |
| `(auth)/vehicle-info.tsx` | Issues found | Missing error handling for API failures |
| `(auth)/pending-approval.tsx` | Clean | Simple status display |
| `(auth)/_layout.tsx` | Clean | Stack navigator |
| `(rider)/(tabs)/home.tsx` | Issues found | Missing error boundary, map state |
| `(rider)/(tabs)/activity.tsx` | Issues found | Missing pull-to-refresh, pagination |
| `(rider)/(tabs)/profile.tsx` | Issues found | Hardcoded localhost URL |
| `(rider)/(tabs)/services.tsx` | Clean | Static content |
| `(rider)/confirm.tsx` | Issues found | Missing error handling for fare estimate |
| `(rider)/pick-location.tsx` | Issues found | Missing error handling for geocoding |
| `(rider)/search.tsx` | Issues found | Missing debounce cleanup |
| `(rider)/trip/[id].tsx` | Issues found | Duplicate WS listeners, missing cleanup |
| `(rider)/trip/rate.tsx` | Clean | Simple rating form |
| `(rider)/settings/documents.tsx` | Issues found | Hardcoded localhost URL |
| `(driver)/(tabs)/home.tsx` | Issues found | Complex state, potential memory leaks |
| `(driver)/(tabs)/earnings.tsx` | Clean | Simple earnings display |
| `(driver)/(tabs)/profile.tsx` | Issues found | Hardcoded localhost URL |
| `(driver)/trip/[id].tsx` | Issues found | Missing route recalculation error handling |
| `support/complaints.tsx` | Issues found | Missing pagination for comments |
| `index.tsx` | Clean | Placeholder |
| `offline.tsx` | Clean | Simple offline state |
| `_layout.tsx` | Issues found | Complex routing logic, potential race conditions |

---

## HIGH FINDINGS

### HIGH MOB-S-001: Duplicate WebSocket Listeners in Trip Screen

- **File**: `mobile/app/(rider)/trip/[id].tsx:60-80`
- **Category**: bug
- **Impact**: Memory leak, duplicate event handling

**Description**

The trip screen sets up WebSocket listeners in two places:
1. Line 27-35: `subscribe('trip', ...)` and `unsubscribe` in useEffect
2. Line 60-80: `wsOn('trip_matched', ...)`, `wsOn('driver_location_update', ...)`, etc.

The `useWebSocket` hook already manages subscriptions internally. The manual `subscribe` call plus the `wsOn` listeners create duplicate event handling.

```tsx
// Line 27-35
useEffect(() => {
  if (tripId) {
    subscribe('trip', `${tripId}:rider`);
  }
  return () => {
    if (tripId) {
      unsubscribe('trip', `${tripId}:rider`);
    }
  };
}, [tripId, subscribe, unsubscribe]);

// Line 60-80
useEffect(() => {
  const u1 = wsOn('trip_matched', ...);
  const u2 = wsOn('driver_location_update', ...);
  // ... more listeners
  return () => { u1(); u2(); ... };
}, [wsOn]);
```

**Recommendation**

Either use the channel subscription pattern OR the event listener pattern, not both:
```tsx
// Option 1: Channel subscription only
useEffect(() => {
  if (!tripId) return;
  subscribe('trip', `${tripId}:rider`);
  return () => unsubscribe('trip', `${tripId}:rider`);
}, [tripId]);

// Option 2: Event listeners only (if hook auto-subscribes)
useEffect(() => {
  const handlers = [
    wsOn('trip_matched', handleMatched),
    wsOn('driver_location_update', handleLocation),
    // ...
  ];
  return () => handlers.forEach(fn => fn());
}, []);
```

---

### HIGH MOB-S-002: Driver Home WebSocket Cleanup Race Condition

- **File**: `mobile/app/(driver)/(tabs)/home.tsx:80-95`
- **Category**: bug
- **Impact**: Memory leak, stale callbacks

**Description**

The cleanup effect uses `isOnlineRef.current` to check state, but the cleanup runs after the component unmounts. The ref may have been updated by a subsequent render.

```tsx
useEffect(() => {
  return () => {
    if (isOnlineRef.current) {
      locationService.stopBackgroundTracking().catch(() => {});
      stopTracking();
      wsUnsubsRef.current.forEach(fn => fn());
      wsService.disconnect();
      isOnlineRef.current = false;
    }
  };
}, []);
```

Additionally, `wsUnsubsRef.current` is mutated during the component lifecycle, which can cause issues if cleanup runs while subscriptions are being added.

**Recommendation**

Use a mounted ref pattern and ensure cleanup is idempotent:
```tsx
const isMounted = useRef(true);

useEffect(() => {
  return () => {
    isMounted.current = false;
    // Always cleanup, don't check refs
    locationService.stopBackgroundTracking().catch(() => {});
    stopTracking();
    wsUnsubsRef.current.forEach(fn => fn());
    wsService.disconnect();
  };
}, []);
```

---

### HIGH MOB-S-003: Missing Error Boundary at Screen Level

- **File**: All screen files
- **Category**: edge-case
- **Impact**: App crash on unhandled errors

**Description**

None of the screen components wrap their content in error boundaries. If a child component throws during render (e.g., map loading failure, image decode error), the entire app crashes.

**Recommendation**

Add a screen-level error boundary:
```tsx
// components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };
  
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorScreen onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

// Usage in screens
export default function RiderHome() {
  return (
    <ErrorBoundary>
      <SafeAreaView>...</SafeAreaView>
    </ErrorBoundary>
  );
}
```

---

### HIGH MOB-S-004: Hardcoded Localhost URLs in Image Sources

- **File**: `mobile/app/(rider)/(tabs)/profile.tsx:95`, `mobile/app/(rider)/settings/documents.tsx`, `mobile/app/(driver)/(tabs)/profile.tsx`
- **Category**: bug
- **Impact**: Images fail to load on real devices

**Description**

Multiple screens replace `localhost` with a hardcoded IP address:

```tsx
// profile.tsx:95
<Image source={{ uri: profileImageUrl.replace("localhost", "192.168.1.3") }} />

// documents.tsx
<Image source={{ uri: img.url.replace('localhost', '192.168.1.3') }} />
```

This hardcoded IP only works on the developer's local network. On production or other networks, images will fail to load.

**Recommendation**

Use environment configuration:
```tsx
// lib/config.ts
export const API_HOST = process.env.EXPO_PUBLIC_API_HOST || 'localhost';

// In screens
const imageUrl = profileImageUrl?.replace('localhost', API_HOST);
```

Or better, have the backend return fully qualified URLs.

---

### HIGH MOB-S-005: Root Layout Complex Routing Logic Has Race Conditions

- **File**: `mobile/app/_layout.tsx:60-130`
- **Category**: bug
- **Impact**: Incorrect routing, screen flicker

**Description**

The root layout has complex routing logic with multiple useEffects that depend on overlapping state. The routing logic has several issues:

1. **Race condition**: `onboardingStatus` is fetched asynchronously, but routing decisions happen before it's resolved
2. **Multiple redirects**: Different effects can trigger conflicting redirects
3. **Early returns**: The `return` after `SplashScreen.hideAsync()` can skip needed routing

```tsx
useEffect(() => {
  if (isAuthenticated && role === 'DRIVER' && (isOnboarding || onboardingStatus === null)) {
    fetchOnboardingStatus();
  }
}, [isAuthenticated, role, isOnboarding, onboardingStatus]);

useEffect(() => {
  // Complex routing logic that depends on onboardingStatus
  // but may run before fetchOnboardingStatus completes
}, [isAuthenticated, isReady, role, isOnboarding, segments, onboardingStatus, documentsStatus]);
```

**Recommendation**

Consolidate routing into a single effect with explicit state machine:
```tsx
type RouteState = 'checking' | 'unauthenticated' | 'onboarding' | 'authenticated';

const [routeState, setRouteState] = useState<RouteState>('checking');

useEffect(() => {
  if (!isReady) return;
  
  if (!isAuthenticated) {
    setRouteState('unauthenticated');
  } else if (role === 'DRIVER' && needsOnboarding) {
    setRouteState('onboarding');
  } else {
    setRouteState('authenticated');
  }
}, [isReady, isAuthenticated, role, needsOnboarding]);

useEffect(() => {
  switch (routeState) {
    case 'unauthenticated':
      router.replace('/(auth)/welcome');
      break;
    case 'onboarding':
      router.replace(getOnboardingStep());
      break;
    case 'authenticated':
      router.replace(getHomeRoute());
      break;
  }
}, [routeState]);
```

---

## MEDIUM FINDINGS

### MEDIUM MOB-S-006: Missing Phone Number Format Validation

- **File**: `mobile/app/(auth)/phone.tsx:20-30`
- **Category**: edge-case
- **Impact**: Invalid phone numbers accepted

**Description**

The phone screen only checks length (`phoneNumber.length < 8`) but doesn't validate the format. Users can enter invalid characters or impossible phone numbers.

```tsx
const handleNext = async () => {
  if (phoneNumber.length < 8) return;
  // No format validation
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+20${phoneNumber.replace(/^0+/, '')}`;
```

**Recommendation**

Add phone format validation:
```tsx
const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 15;
};
```

---

### MEDIUM MOB-S-007: Missing Email Validation in Basic Info

- **File**: `mobile/app/(auth)/basic-info.tsx:30-40`
- **Category**: edge-case
- **Impact**: Invalid emails accepted

**Description**

The form only checks if email is truthy, not if it's a valid email format.

```tsx
const isFormValid = firstName && lastName && email && password.length >= 6;
```

**Recommendation**

```tsx
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isFormValid = firstName && lastName && isValidEmail(email) && password.length >= 6;
```

---

### MEDIUM MOB-S-008: OTP Expiry Timer Doesn't Disable Verify Button

- **File**: `mobile/app/(auth)/verify-otp.tsx:50-70`
- **Category**: edge-case
- **Impact**: User can submit expired OTP

**Description**

The `isExpired` state exists but the timer logic is missing. The resend timer counts down but there's no actual OTP expiry tracking.

```tsx
const [isExpired, setIsExpired] = useState(false);
// isExpired is never set to true
```

**Recommendation**

Track OTP expiry:
```tsx
const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const [otpExpiry, setOtpExpiry] = useState<number | null>(null);

useEffect(() => {
  if (otpExpiry) {
    const timer = setInterval(() => {
      if (Date.now() > otpExpiry) {
        setIsExpired(true);
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }
}, [otpExpiry]);

// When requesting OTP
setOtpExpiry(Date.now() + OTP_EXPIRY_SECONDS * 1000);
```

---

### MEDIUM MOB-S-009: Missing Pull-to-Refresh in Activity Screen

- **File**: `mobile/app/(rider)/(tabs)/activity.tsx:50-80`
- **Category**: ux
- **Impact**: Users cannot manually refresh trip list

**Description**

The activity screen loads trips on focus but has no pull-to-refresh capability.

**Recommendation**

```tsx
<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isLoading}
      onRefresh={loadTrips}
      tintColor="#10b981"
    />
  }
>
```

---

### MEDIUM MOB-S-010: Missing Pagination in Activity Screen

- **File**: `mobile/app/(rider)/(tabs)/activity.tsx`
- **Category**: performance
- **Impact**: Performance degradation with many trips

**Description**

The activity screen loads all trips at once with no pagination. As users accumulate trips, this will become slow.

**Recommendation**

Implement cursor-based pagination:
```tsx
const [cursor, setCursor] = useState<string | null>(null);
const [hasMore, setHasMore] = useState(true);

const loadTrips = async (reset = false) => {
  const data = await TripApi.getMyTrips({ 
    cursor: reset ? null : cursor,
    limit: 20 
  });
  setTrips(prev => reset ? data : [...prev, ...data]);
  setCursor(data[data.length - 1]?.id);
  setHasMore(data.length === 20);
};
```

---

### MEDIUM MOB-S-011: Search Debounce Missing Cleanup

- **File**: `mobile/app/(rider)/search.tsx:70-90`
- **Category**: bug
- **Impact**: Stale search results, memory leak

**Description**

The debounce timer in search is cleared but not tracked in a ref, which can cause issues with rapid field switching.

```tsx
useEffect(() => {
  const timer = setTimeout(async () => {
    // search
  }, 300);
  return () => clearTimeout(timer);
}, [activeQuery, activeField, pickupSet, dropoffSet]);
```

**Recommendation**

Use a ref for the timer and cancel previous searches:
```tsx
const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  if (abortControllerRef.current) abortControllerRef.current.abort();
  
  const controller = new AbortController();
  abortControllerRef.current = controller;
  
  searchTimerRef.current = setTimeout(async () => {
    try {
      const data = await mapProvider.searchPlaces(q, currentLocation, controller.signal);
      if (!controller.signal.aborted) {
        setResults(data);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // handle error
      }
    }
  }, 300);
  
  return () => {
    clearTimeout(searchTimerRef.current!);
    controller.abort();
  };
}, [activeQuery]);
```

---

### MEDIUM MOB-S-012: Missing File Size Validation for Document Uploads

- **File**: `mobile/app/(auth)/documents.tsx:30-50`, `mobile/app/(auth)/driver-documents.tsx:60-90`
- **Category**: edge-case
- **Impact**: Large files may fail to upload

**Description**

Document upload screens don't validate file size before uploading. Large images may exceed server limits or cause memory issues.

```tsx
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
  // No maxSize option
});
```

**Recommendation**

Check file size after selection:
```tsx
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({...});
  if (!result.canceled && result.assets[0]) {
    const asset = result.assets[0];
    // Check file size if available
    if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
      Alert.alert('File Too Large', 'Please select an image smaller than 5MB.');
      return;
    }
    setUri(asset.uri);
  }
};
```

---

### MEDIUM MOB-S-013: Missing Date Format Validation in Driver Profile Extra

- **File**: `mobile/app/(auth)/driver-profile-extra.tsx:40-50`
- **Category**: edge-case
- **Impact**: Invalid date format sent to backend

**Description**

The date of birth field accepts any string without validation.

```tsx
<TextInput
  placeholder="YYYY-MM-DD"
  value={dob}
  onChangeText={setDob}
/>
```

**Recommendation**

Add date validation:
```tsx
const isValidDate = (date: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const d = new Date(date);
  return !isNaN(d.getTime()) && d < new Date();
};
```

---

### MEDIUM MOB-S-014: Driver Trip Screen Route Recalculation Missing Error Handling

- **File**: `mobile/app/(driver)/trip/[id].tsx:40-55`
- **Category**: edge-case
- **Impact**: Route silently fails to update

**Description**

Route recalculation errors are silently swallowed:

```tsx
mapProvider.getRoute(origin, target)
  .then((r) => setRouteCoords(r.coordinates))
  .catch(() => { }); // Silent failure
```

**Recommendation**

Handle errors gracefully:
```tsx
const [routeError, setRouteError] = useState(false);

mapProvider.getRoute(origin, target)
  .then((r) => {
    setRouteCoords(r.coordinates);
    setRouteError(false);
  })
  .catch(() => {
    setRouteError(true);
    // Show fallback message
  });
```

---

### MEDIUM MOB-S-015: Missing RTL Support

- **File**: All screen files
- **Category**: ux
- **Impact**: Poor Arabic user experience

**Description**

The app uses hardcoded `ml-`, `mr-`, `left-`, `right-` Tailwind classes that don't flip for RTL languages. Arabic users will see misaligned layouts.

**Recommendation**

Use logical properties:
- Replace `ml-*` with `ms-*` (margin-start)
- Replace `mr-*` with `me-*` (margin-end)
- Replace `left-*` with `start-*`
- Replace `right-*` with `end-*`

Or wrap directional components:
```tsx
import { I18nManager } from 'react-native';

const isRTL = I18nManager.isRTL;
<View style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
```

---

## LOW FINDINGS

### LOW MOB-S-016: Inconsistent Loading State Styling

- **File**: Multiple screens
- **Category**: code-quality
- **Impact**: Inconsistent UX

**Description**

Loading states are styled differently across screens:
- Some use `ActivityIndicator` with custom color
- Some use text like "Loading..."
- Some use both
- Sizes vary (small, large)

**Recommendation**

Create a reusable loading component:
```tsx
// components/LoadingSpinner.tsx
export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <View className="items-center">
      <ActivityIndicator color="#10b981" size="large" />
      {message && <Text className="text-zinc-500 mt-4">{message}</Text>}
    </View>
  );
}
```

---

### LOW MOB-S-017: Missing Accessibility Labels

- **File**: All screen files
- **Category**: code-quality
- **Impact**: Poor screen reader experience

**Description**

Touchables lack accessibility labels:
```tsx
<TouchableOpacity onPress={handleBack}>
  <Ionicons name="arrow-back" size={24} color="white" />
</TouchableOpacity>
```

**Recommendation**

```tsx
<TouchableOpacity 
  onPress={handleBack}
  accessible={true}
  accessibilityLabel="Go back"
  accessibilityRole="button"
>
  <Ionicons name="arrow-back" size={24} color="white" />
</TouchableOpacity>
```

---

### LOW MOB-S-018: Console.log Statements Left in Production Code

- **File**: `mobile/app/_layout.tsx`, `mobile/app/(driver)/(tabs)/home.tsx`, `mobile/app/(rider)/trip/[id].tsx`
- **Category**: code-quality
- **Impact**: Performance, security

**Description**

Multiple `console.log` debug statements are left in the code:
```tsx
console.log('[LayoutDebug] State:', {...});
console.log('[DriverHome] Subscribing to driver channel with ID:', me.id);
console.log('[TripScreen] Subscribing to trip channel:', tripId);
```

**Recommendation**

Remove or wrap in `__DEV__`:
```tsx
if (__DEV__) {
  console.log('[LayoutDebug] State:', {...});
}
```

---

### LOW MOB-S-019: Pending Approval Screen Static "Tomorrow" Estimate

- **File**: `mobile/app/(auth)/pending-approval.tsx:25-30`
- **Category**: ux
- **Impact**: Misleading estimate

**Description**

The pending approval screen shows a hardcoded "Tomorrow" estimate:
```tsx
<Text className="text-white font-medium text-lg">Tomorrow</Text>
```

**Recommendation**

Either remove the estimate or make it dynamic based on actual processing time.

---

### LOW MOB-S-020: Missing Empty State for Nearby Drivers

- **File**: `mobile/app/(rider)/(tabs)/home.tsx`, `mobile/app/(rider)/confirm.tsx`
- **Category**: ux
- **Impact**: Users don't know if no drivers available

**Description**

When no nearby drivers are found, there's no indication to the user. The map just shows no car markers.

**Recommendation**

Add an indicator when no drivers are nearby:
```tsx
{drivers.length === 0 && (
  <View className="absolute bottom-32 left-4 right-4 bg-zinc-900/90 p-4 rounded-2xl">
    <Text className="text-zinc-400 text-center">No drivers nearby</Text>
  </View>
)}
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| MOB-S-001 | WS-001 (WebSocket connection auth) |
| MOB-S-002 | MOB-HK-003 (useLocation cleanup) |
| MOB-S-004 | INT-BM-001 (API host configuration) |
| MOB-S-005 | MOB-NA-001 (Auth guard race conditions) |
| MOB-S-011 | MOB-API-002 (Request cancellation) |
| MOB-S-015 | DASH-C-003 (RTL support in dashboard) |