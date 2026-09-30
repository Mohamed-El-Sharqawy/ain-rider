# Mobile Hooks & Services Code Review

**Workspace**: mobile
**Domain**: hooks, services
**Date**: 2026-04-07
**Files Covered**: 5 hooks, 8 service files

## Summary

The hooks and services layer provides abstractions for WebSocket, location tracking, map providers, and trip management. The WebSocket service has robust reconnection logic and the location service handles foreground/background tracking well. However, there are several issues: missing cleanup in hooks, hardcoded URLs, missing error handling, potential memory leaks, and console.log statements in production code.

## Files Covered

| File | Status | Notes |
|------|--------|-------|
| `hooks/useAuthCheck.ts` | Issues found | Missing userId extraction, race condition |
| `hooks/useLocation.ts` | Issues found | Missing cleanup, error handling |
| `hooks/useNearbyDrivers.ts` | Issues found | Missing loading state, error handling |
| `hooks/useTrip.ts` | Issues found | Missing cleanup, hardcoded URL |
| `hooks/useWebSocket.ts` | Issues found | Missing reconnection state |
| `services/websocket.service.ts` | Issues found | Missing auth, console.log |
| `services/location.service.ts` | Issues found | Silent fallback, missing error state |
| `services/background-tasks.ts` | Issues found | Missing auth token refresh |
| `services/map/map.provider.ts` | Clean | Interface definition |
| `services/map/index.ts` | Clean | Factory function |
| `services/map/osm.provider.ts` | Issues found | Missing timeout on some calls |
| `services/map/polyline.ts` | Not reviewed | Utility |
| `services/map/google.provider.ts` | Not reviewed | Alternative provider |

---

## HIGH FINDINGS

### HIGH MOB-HK-001: WebSocket Service Missing Authentication

- **File**: `mobile/services/websocket.service.ts:30-50`
- **Category**: security
- **Impact**: Unauthenticated WebSocket connections

**Description**

The WebSocket service connects without authentication. The server may reject unauthenticated connections or, worse, accept them without user identity verification.

```tsx
connect(wsUrl: string): void {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    return;
  }

  this.ws = new ReconnectingWebSocket(wsUrl, [], {
    // No auth headers - WebSocket doesn't support custom headers
  });
}
```

**Recommendation**

Pass auth token in connection URL or send immediately after connection:
```tsx
async connect(wsUrl: string): Promise<void> {
  const token = await SecureStorage.getAccessToken();
  const url = new URL(wsUrl);
  if (token) {
    url.searchParams.set('token', token);
  }
  
  this.ws = new ReconnectingWebSocket(url.toString(), [], {
    // ...
  });
  
  // Or send auth message after connection
  this.ws.onopen = () => {
    this.send({ type: 'auth', token });
    // ...
  };
}
```

---

### HIGH MOB-HK-002: useLocation Hook Missing Cleanup on Unmount

- **File**: `mobile/hooks/useLocation.ts:15-30`
- **Category**: bug
- **Impact**: Memory leak, continued location tracking

**Description**

The hook starts location tracking but doesn't stop it when the component unmounts. The `mounted` ref only prevents double initialization.

```tsx
useEffect(() => {
  if (mounted.current) return;
  mounted.current = true;

  (async () => {
    const granted = await locationService.requestPermissions();
    // ...
  })();
}, []); // Missing cleanup

const startTracking = async (onUpdate?: ...) => {
  await locationService.startTracking((loc) => {
    // No tracking of whether component is still mounted
    setLocation(loc, loc.heading, loc.speed);
    onUpdate?.(loc);
  });
  setTracking(true);
};
```

**Recommendation**

Add proper cleanup:
```tsx
useEffect(() => {
  let mounted = true;
  let tracking = false;

  (async () => {
    const granted = await locationService.requestPermissions();
    if (!mounted) return;
    setPermission(granted);
    // ...
  })();

  return () => {
    mounted = false;
    if (tracking) {
      locationService.stopTracking();
    }
  };
}, []);

const startTracking = async (onUpdate?: ...) => {
  tracking = true;
  await locationService.startTracking((loc) => {
    if (!mounted) return; // Don't update unmounted component
    setLocation(loc, loc.heading, loc.speed);
    onUpdate?.(loc);
  });
  setTracking(true);
};
```

---

### HIGH MOB-HK-003: useTrip Hook WebSocket Connection Not Cleaned Up

- **File**: `mobile/hooks/useTrip.ts:20-45`
- **Category**: bug
- **Impact**: Memory leak, orphaned WebSocket connections

**Description**

The `requestTrip` function connects to WebSocket and subscribes to a channel, but there's no cleanup when the component unmounts or when the trip completes.

```tsx
const requestTrip = useCallback(
  async (onMatched?: (tripId: string) => void) => {
    // ...
    wsService.connect(WS_URL);
    wsService.subscribe('trip', `${trip.id}:rider`);
    // No cleanup tracking
    onMatched?.(trip.id);
  },
  [store],
);
```

**Recommendation**

Return cleanup function and track subscription:
```tsx
export function useTrip() {
  const store = useTripStore();
  const subscriptionRef = useRef<{ channel: string; id: string } | null>(null);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        wsService.unsubscribe(subscriptionRef.current.channel, subscriptionRef.current.id);
        subscriptionRef.current = null;
      }
    };
  }, []);

  const requestTrip = useCallback(async (onMatched?: (tripId: string) => void) => {
    // ...
    wsService.connect(WS_URL);
    wsService.subscribe('trip', `${trip.id}:rider`);
    subscriptionRef.current = { channel: 'trip', id: `${trip.id}:rider` };
    onMatched?.(trip.id);
  }, [store]);

  const cancelTrip = useCallback(async (tripId: string, reason: string) => {
    await TripApi.cancelTrip(tripId, reason);
    wsService.unsubscribe('trip', `${tripId}:rider`);
    subscriptionRef.current = null;
    store.reset();
  }, [store]);
}
```

---

### HIGH MOB-HK-004: Background Task Missing Auth Token Refresh

- **File**: `mobile/services/background-tasks.ts:25-50`
- **Category**: bug
- **Impact**: Background location updates fail after token expiry

**Description**

The background task handles 401 errors by stopping the task, but doesn't attempt to refresh the token. If the token expires during a long shift, the driver's location stops updating.

```tsx
try {
  await LocationApi.updateDriverLocation({...});
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    console.warn('[BackgroundTask] Auth expired, stopping background task');
    await Location.stopLocationUpdatesAsync(TASK_NAME);
    return; // Just stops - no attempt to refresh
  }
}
```

**Recommendation**

Attempt token refresh before stopping:
```tsx
try {
  await LocationApi.updateDriverLocation({...});
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    // Try to refresh token
    const newToken = await SecureStorage.getAccessToken();
    if (newToken) {
      // Retry the request
      try {
        await LocationApi.updateDriverLocation({...});
        return; // Success, don't stop
      } catch {
        // Still failed, fall through to stop
      }
    }
    console.warn('[BackgroundTask] Auth expired, stopping background task');
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}
```

---

## MEDIUM FINDINGS

### MEDIUM MOB-HK-005: useAuthCheck Missing userId Extraction

- **File**: `mobile/hooks/useAuthCheck.ts:15-30`
- **Category**: bug
- **Impact**: userId not set in auth store

**Description**

The hook extracts `role` from the JWT but not `userId`, even though the auth store has a `userId` field.

```tsx
const decoded = jwtDecode<TokenPayload>(accessToken);
// ...
if (decoded.exp > currentTime) {
  setAuth(true, decoded.role); // Missing userId
  setIsReady(true);
  return;
}
```

**Recommendation**

Extract and set userId:
```tsx
if (decoded.exp > currentTime) {
  setAuth(true, decoded.role, decoded.sub || decoded.userId);
  setIsReady(true);
  return;
}
```

---

### MEDIUM MOB-HK-006: useNearbyDrivers Missing Loading and Error States

- **File**: `mobile/hooks/useNearbyDrivers.ts:20-40`
- **Category**: bug
- **Impact**: UI cannot show loading/error states

**Description**

The hook returns only `drivers`, not loading or error states. Components can't show a loading indicator or error message.

```tsx
export function useNearbyDrivers(latitude?: number, longitude?: number, enabled: boolean = true) {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  // No loading state, no error state
  
  const fetchNearby = async () => {
    try {
      const data = await MatchApi.getNearbyDrivers(latitude, longitude);
      setDrivers(data);
    } catch (error) {
      console.error('Failed to fetch nearby drivers:', error);
      // Error is logged but not exposed
    }
  };
  
  return drivers; // Only drivers
};
```

**Recommendation**

Return loading and error states:
```tsx
export function useNearbyDrivers(...) {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNearby = async () => {
    if (!latitude || !longitude) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await MatchApi.getNearbyDrivers(latitude, longitude);
      setDrivers(data);
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return { drivers, isLoading, error, refetch: fetchNearby };
}
```

---

### MEDIUM MOB-HK-007: WebSocket Service Console.log in Production

- **File**: `mobile/services/websocket.service.ts:60-120`
- **Category**: code-quality
- **Impact**: Performance, security

**Description**

Multiple console.log statements throughout the WebSocket service:
```tsx
console.log('[WebSocketService] Connected');
console.log('[WebSocketService] Disconnected, will auto-reconnect');
console.log('[WebSocketService] Attempting to send:', message.type, message);
console.log('[WebSocketService] Sent immediately');
console.log('[WebSocketService] Connection not open, queuing message...');
```

**Recommendation**

Remove or wrap in `__DEV__`:
```tsx
if (__DEV__) {
  console.log('[WebSocketService] Connected');
}
```

---

### MEDIUM MOB-HK-008: Location Service Silent Fallback to Baghdad

- **File**: `mobile/services/location.service.ts:25-35`
- **Category**: bug
- **Impact**: User shown wrong location

**Description**

When location fails, the service silently returns Baghdad coordinates without indicating the failure. The user may not realize their location is wrong.

```tsx
async getCurrentLocation(): Promise<LocationUpdate> {
  try {
    const location = await ExpoLocation.getCurrentPositionAsync({...});
    return { /* real location */ };
  } catch (error) {
    console.warn('[LocationService] Failed to get real location, using fallback:', error);
    return {
      ...BAGHDAD, // Silent fallback
      heading: 0,
      speed: 0,
    };
  }
}
```

**Recommendation**

Throw error or return null with error indication:
```tsx
async getCurrentLocation(): Promise<LocationUpdate> {
  try {
    const location = await ExpoLocation.getCurrentPositionAsync({...});
    return { /* real location */ };
  } catch (error) {
    console.warn('[LocationService] Failed to get location:', error);
    throw new Error('Unable to get current location. Please check location permissions.');
  }
}
```

---

### MEDIUM MOB-HK-009: OSM Provider Missing Timeout on Geocoding

- **File**: `mobile/services/map/osm.provider.ts:50-80`
- **Category**: bug
- **Impact**: Geocoding requests hang

**Description**

The `getRoute` method has a 3-second timeout, but `geocode`, `reverseGeocode`, and `searchPlaces` don't have timeouts.

```tsx
// getRoute has timeout
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 3000);

// geocode doesn't
const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
  headers: { 'User-Agent': 'ain-rider/1.0' },
});
```

**Recommendation**

Add timeout to all fetch calls:
```tsx
async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

---

### MEDIUM MOB-HK-010: useWebSocket Missing Connection State

- **File**: `mobile/hooks/useWebSocket.ts:10-25`
- **Category**: bug
- **Impact**: UI can't show connection status

**Description**

The hook returns `isConnected` as a ref, but this doesn't update when the WebSocket reconnects or disconnects.

```tsx
const connected = useRef(false);

useEffect(() => {
  if (autoConnect) {
    wsService.connect(WS_URL);
    connected.current = true; // Set but never updated
  }
  // ...
}, [autoConnect]);

return {
  // ...
  isConnected: connected, // Ref, not reactive state
};
```

**Recommendation**

Use state for connection status:
```tsx
const [isConnected, setIsConnected] = useState(false);

useEffect(() => {
  if (autoConnect) {
    wsService.connect(WS_URL);
    setIsConnected(true);
  }

  const unsub = wsService.on('connected', () => setIsConnected(true));
  const unsub2 = wsService.on('disconnected', () => setIsConnected(false));

  return () => {
    unsub();
    unsub2();
    if (autoConnect) {
      wsService.disconnect();
      setIsConnected(false);
    }
  };
}, [autoConnect]);

return { isConnected };
```

---

### MEDIUM MOB-HK-011: Hardcoded WebSocket URL in Multiple Files

- **File**: `mobile/hooks/useTrip.ts:7`, `mobile/hooks/useWebSocket.ts:5`, `mobile/app/(driver)/(tabs)/home.tsx:15`
- **Category**: code-quality
- **Impact**: Inconsistent configuration

**Description**

The WebSocket URL is defined in multiple places:
```tsx
// useTrip.ts
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// useWebSocket.ts
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// driver home.tsx
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
```

**Recommendation**

Centralize configuration:
```tsx
// lib/config.ts
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// In hooks
import { WS_URL } from '../lib/config';
```

---

## LOW FINDINGS

### LOW MOB-HK-012: useAuthCheck Console.log in Production

- **File**: `mobile/hooks/useAuthCheck.ts:45-50`
- **Category**: code-quality
- **Impact**: Performance

**Description**

```tsx
console.error('[AuthDebug] Auth check failed:', e);
console.log('[AuthDebug] Auth ready. Ready:', true);
```

**Recommendation**

Remove or wrap in `__DEV__`.

---

### LOW MOB-HK-013: useNearbyDrivers Polling Interval Not Configurable

- **File**: `mobile/hooks/useNearbyDrivers.ts:35`
- **Category**: code-quality
- **Impact**: Inflexible configuration

**Description**

The polling interval is hardcoded to 10 seconds:
```tsx
pollInterval.current = setInterval(fetchNearby, 10000);
```

**Recommendation**

Make it configurable:
```tsx
export function useNearbyDrivers(
  latitude?: number, 
  longitude?: number, 
  options?: { enabled?: boolean; pollInterval?: number }
) {
  const { enabled = true, pollInterval = 10000 } = options || {};
  // ...
}
```

---

### LOW MOB-HK-014: OSM Provider Duplicate BAGHDAD Constant

- **File**: `mobile/services/location.service.ts:10-11`
- **Category**: code-quality
- **Impact**: Code duplication

**Description**

```tsx
// const BAGHDAD = { latitude: 30.147719, longitude: 31.394327 };
const BAGHDAD = { latitude: 30.147719, longitude: 31.394327 };
```

There's a commented-out duplicate line.

**Recommendation**

Remove the commented line.

---

### LOW MOB-HK-015: WebSocket Service Notification Rate Limit Too Aggressive

- **File**: `mobile/services/websocket.service.ts:50-60`
- **Category**: edge-case
- **Impact**: Missed notifications

**Description**

The notification rate limit is 2 seconds:
```tsx
if (now - this.lastNotificationTime > 2000) {
  this.presentLocalNotification(...);
  this.lastNotificationTime = now;
}
```

If multiple trips are assigned within 2 seconds, only one notification shows.

**Recommendation**

Increase to 5 seconds or queue notifications:
```tsx
if (now - this.lastNotificationTime > 5000) {
  // ...
}
```

---

### LOW MOB-HK-016: Map Provider Factory Doesn't Handle Invalid Provider

- **File**: `mobile/services/map/index.ts:5-10`
- **Category**: edge-case
- **Impact**: Runtime error on invalid config

**Description**

```tsx
const MAP_PROVIDER = process.env.EXPO_PUBLIC_MAP_PROVIDER || 'osm';

export function getMapProvider(): MapProvider {
  return MAP_PROVIDER === 'google' ? new GoogleMapProvider() : new OsmProvider();
}
```

If `EXPO_PUBLIC_MAP_PROVIDER` is set to an invalid value, it silently falls back to OSM.

**Recommendation**

Validate and warn:
```tsx
export function getMapProvider(): MapProvider {
  if (MAP_PROVIDER === 'google') {
    return new GoogleMapProvider();
  }
  if (MAP_PROVIDER !== 'osm') {
    console.warn(`Unknown map provider "${MAP_PROVIDER}", falling back to OSM`);
  }
  return new OsmProvider();
}
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| MOB-HK-001 | WS-001 (WebSocket auth) |
| MOB-HK-002 | MOB-S-002 (Driver home cleanup) |
| MOB-HK-003 | MOB-S-001 (Duplicate WS listeners) |
| MOB-HK-004 | MOB-API-003 (Token refresh race) |
| MOB-HK-005 | MOB-ST-001 (Auth store userId) |
| MOB-HK-006 | MOB-S-020 (Empty state for drivers) |
| MOB-HK-008 | MOB-ST-008 (Location error state) |
| MOB-HK-011 | MOB-API-012 (Base URL validation) |