# Auth & WebSocket Integration Code Review

**Workspace**: mobile, dashboard, backend
**Domain**: auth, websocket, integration
**Date**: 2026-04-07
**Files Covered**: Auth flows, WebSocket services, token management

## Summary

The auth and WebSocket integration has several critical issues. Both platforms lack proper WebSocket authentication - connections are established without passing auth tokens. Token refresh has race conditions that can cause auth failures. The mobile app's background location updates fail when tokens expire. The dashboard's auth store doesn't persist, causing logout on refresh. WebSocket reconnection logic is robust but missing auth re-validation.

## Architecture Overview

### Mobile Auth Flow
1. User logs in via `AuthApi.login()` or `AuthApi.verifyOtp()`
2. Tokens stored in `SecureStore` (accessToken, refreshToken)
3. `useAuthCheck` validates token on app start
4. `client.ts` intercepts 401 and refreshes tokens
5. WebSocket connects without auth token

### Dashboard Auth Flow
1. User logs in via `useLogin` mutation
2. Tokens stored in HTTP-only cookies (via `withCredentials: true`)
3. `ProtectedRoute` validates session via `useGetMe`
4. `api/client.ts` intercepts 401 and refreshes via `/auth/refresh`
5. WebSocket connects without auth token

### WebSocket Flow
1. Mobile: `wsService.connect(WS_URL)` - no auth
2. Dashboard: `useWebSocket` hook - no auth
3. Backend: WebSocket server accepts connections, no token validation
4. Subscriptions managed via `subscribe(channel, id)` messages

---

## HIGH FINDINGS

### HIGH AUTH-WS-001: WebSocket Missing Authentication (All Platforms)

- **File**: 
  - `mobile/services/websocket.service.ts:30-50`
  - `dashboard/src/hooks/useWebSocket.ts:30-50`
  - `backend/apps/elysia/websocket-server/src/index.ts`
- **Category**: security
- **Impact**: Unauthorized WebSocket access, impersonation attacks

**Description**

WebSocket connections are established without any authentication:

**Mobile:**
```tsx
connect(wsUrl: string): void {
  this.ws = new ReconnectingWebSocket(wsUrl, [], {
    // No auth headers - WebSocket doesn't support custom headers
  });
}
```

**Dashboard:**
```tsx
const ws = new WebSocket(WS_URL);
// No auth token passed
```

**Backend:**
```tsx
// No token validation on connection
wsServer.on('connection', (ws) => {
  // Connection accepted without identity verification
});
```

**Recommendation**

Pass auth token in connection URL or send immediately after connection:

**Mobile:**
```tsx
async connect(wsUrl: string): Promise<void> {
  const token = await SecureStore.getItemAsync('accessToken');
  const url = token ? `${wsUrl}?token=${token}` : wsUrl;
  this.ws = new ReconnectingWebSocket(url, [], { ... });
  
  // Or send auth message after connection
  this.ws.onopen = () => {
    if (token) {
      this.send({ type: 'auth', token });
    }
    // ...
  };
}
```

**Backend:**
```tsx
wsServer.on('connection', (ws, req) => {
  const token = extractTokenFromUrl(req.url) || 
                extractTokenFromCookie(req.headers.cookie);
  
  if (!token) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  
  try {
    const payload = verifyToken(token);
    ws.userId = payload.sub;
    ws.role = payload.role;
  } catch {
    ws.close(4001, 'Invalid token');
  }
});
```

---

### HIGH AUTH-WS-002: Token Refresh Race Condition (All Platforms)

- **File**:
  - `mobile/lib/api/client.ts:40-80`
  - `dashboard/src/api/client.ts:30-70`
- **Category**: bug
- **Impact**: Multiple refresh requests, auth failures

**Description**

Both platforms have the same token refresh race condition. When multiple requests fail with 401 simultaneously:

**Mobile:**
```tsx
if (status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  const refreshed = await refreshTokens();
  // Other requests may also call refreshTokens() simultaneously
}
```

**Dashboard:**
```tsx
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject });
  });
}
// Queue mechanism exists but has edge cases
```

**Recommendation**

Use proper singleton refresh lock:

```tsx
let refreshPromise: Promise<boolean> | null = null;

async function ensureValidToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = (async () => {
    try {
      await api.post('/auth/refresh');
      return true;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

// In interceptor
if (status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  const success = await ensureValidToken();
  if (success) {
    return api(originalRequest);
  }
}
```

---

### HIGH AUTH-WS-003: Mobile Background Location Fails After Token Expiry

- **File**: `mobile/services/background-tasks.ts:25-50`
- **Category**: bug
- **Impact**: Driver location stops updating during shift

**Description**

When the access token expires during background tracking, the task stops without attempting to refresh:

```tsx
try {
  await LocationApi.updateDriverLocation({...});
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    console.warn('[BackgroundTask] Auth expired, stopping background task');
    await Location.stopLocationUpdatesAsync(TASK_NAME);
    return; // Just stops - no refresh attempt
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
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry the request
      try {
        await LocationApi.updateDriverLocation({...});
        return;
      } catch {
        // Still failed, fall through
      }
    }
    console.warn('[BackgroundTask] Auth expired, stopping');
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!refreshToken) return false;
    
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${refreshToken}` },
    });
    
    if (response.ok) {
      const { accessToken, refreshToken: newRefresh } = await response.json();
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', newRefresh);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
```

---

### HIGH AUTH-WS-004: Dashboard Auth Store Not Persisted

- **File**: `dashboard/src/stores/authStore.ts`
- **Category**: bug
- **Impact**: User logged out on page refresh

**Description**

The auth store doesn't persist state. On page refresh, the user appears logged out:

```tsx
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  // No persistence
}));
```

**Recommendation**

Use Zustand persist middleware:

```tsx
import { persist } from 'zustand/middleware';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clear: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
```

---

## MEDIUM FINDINGS

### MEDIUM AUTH-WS-005: WebSocket Reconnect Missing Auth Re-validation

- **File**: 
  - `mobile/services/websocket.service.ts:80-100`
  - `dashboard/src/hooks/useWebSocket.ts:50-70`
- **Category**: security
- **Impact**: Stale auth on reconnect

**Description**

When WebSocket reconnects after token refresh, it doesn't re-send auth:

**Mobile:**
```tsx
this.ws.onclose = () => {
  // On reconnect, no fresh auth token sent
  this.ws.reconnect();
};
```

**Recommendation**

Re-send auth on reconnect:

```tsx
this.ws.onopen = async () => {
  // Always send fresh token on (re)connect
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    this.send({ type: 'auth', token });
  }
  // ...
};
```

---

### MEDIUM AUTH-WS-006: Mobile useAuthCheck Missing userId Extraction

- **File**: `mobile/hooks/useAuthCheck.ts:15-30`
- **Category**: bug
- **Impact**: userId not set in auth store

**Description**

The hook extracts `role` from JWT but not `userId`:

```tsx
const decoded = jwtDecode<TokenPayload>(accessToken);
if (decoded.exp > currentTime) {
  setAuth(true, decoded.role); // Missing userId
}
```

**Recommendation**

Extract and set userId:

```tsx
if (decoded.exp > currentTime) {
  setAuth(true, decoded.role, decoded.sub || decoded.userId);
}
```

---

### MEDIUM AUTH-WS-007: WebSocket Subscriptions Not Re-subscribed After Reconnect

- **File**: `mobile/services/websocket.service.ts:150-170`
- **Category**: bug
- **Impact**: Missing real-time updates after reconnect

**Description**

Actually, the mobile WebSocket service DOES re-subscribe:

```tsx
private resubscribeAll(): void {
  for (const [channel, id] of this.activeSubscriptions) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel, id }));
    }
  }
}
```

This is called in `onopen`, so this is correctly implemented. However, the dashboard doesn't track subscriptions:

**Dashboard:**
```tsx
// No subscription tracking
// On reconnect, subscriptions are lost
```

**Recommendation for Dashboard:**

Add subscription tracking:

```tsx
const subscriptionsRef = useRef<Map<string, string>>(new Map());

const subscribe = useCallback((channel: string, id: string) => {
  subscriptionsRef.current.set(channel, id);
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: 'subscribe', channel, id }));
  }
}, []);

// In onopen
ws.onopen = () => {
  // Re-subscribe to all
  subscriptionsRef.current.forEach((id, channel) => {
    ws.send(JSON.stringify({ type: 'subscribe', channel, id }));
  });
};
```

---

### MEDIUM AUTH-WS-008: Missing Token Expiry Warning

- **File**: All platforms
- **Category**: ux
- **Impact**: Unexpected logout

**Description**

No warning when token is about to expire. Users are suddenly logged out.

**Recommendation**

Add token expiry monitoring:

```tsx
// In useTokenRefresh
useEffect(() => {
  const checkExpiry = () => {
    const token = getToken();
    if (!token) return;
    
    const decoded = jwtDecode(token);
    const expiresAt = decoded.exp * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now < fiveMinutes) {
      // Warn user
      toast.warning('Session expiring soon', {
        action: { label: 'Extend', onClick: () => refreshToken() }
      });
    }
  };
  
  const interval = setInterval(checkExpiry, 60_000);
  return () => clearInterval(interval);
}, []);
```

---

### MEDIUM AUTH-WS-009: Missing Logout on WebSocket Auth Failure

- **File**: 
  - `mobile/services/websocket.service.ts`
  - `dashboard/src/hooks/useWebSocket.ts`
- **Category**: security
- **Impact**: Compromised session continues

**Description**

If WebSocket receives an auth error (e.g., 4001 close code), the app doesn't log out:

```tsx
ws.onclose = (event) => {
  // No check for auth-related close codes
  console.log('WebSocket closed');
};
```

**Recommendation**

Handle auth-related close codes:

```tsx
ws.onclose = (event) => {
  if (event.code === 4001 || event.code === 4002) {
    // Auth failure - log out
    useAuthStore.getState().clear();
    router.replace('/login');
  }
  // Other close codes - attempt reconnect
};
```

---

## LOW FINDINGS

### LOW AUTH-WS-010: Hardcoded WebSocket URLs

- **File**:
  - `mobile/hooks/useTrip.ts:7`
  - `mobile/hooks/useWebSocket.ts:5`
  - `dashboard/src/hooks/useWebSocket.ts:15`
- **Category**: code-quality
- **Impact**: Configuration issues

**Description**

WebSocket URL is defined in multiple places with hardcoded fallbacks:

```tsx
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';
```

**Recommendation**

Centralize configuration:

```tsx
// lib/config.ts
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// In hooks
import { WS_URL } from '../lib/config';
```

---

### LOW AUTH-WS-011: Missing Connection State Sync

- **File**: `mobile/hooks/useWebSocket.ts`
- **Category**: bug
- **Impact**: UI shows stale connection state

**Description**

The `isConnected` ref doesn't update when WebSocket reconnects:

```tsx
const connected = useRef(false);

useEffect(() => {
  if (autoConnect) {
    wsService.connect(WS_URL);
    connected.current = true; // Never updated on disconnect/reconnect
  }
}, [autoConnect]);
```

**Recommendation**

Use state instead of ref, or listen to connection events:

```tsx
const [isConnected, setIsConnected] = useState(false);

useEffect(() => {
  const unsubConnect = wsService.on('connected', () => setIsConnected(true));
  const unsubDisconnect = wsService.on('disconnected', () => setIsConnected(false));
  
  return () => {
    unsubConnect();
    unsubDisconnect();
  };
}, []);
```

---

### LOW AUTH-WS-012: Missing Rate Limiting on Auth Endpoints

- **File**: 
  - `mobile/app/(auth)/login.tsx`
  - `dashboard/src/pages/login/LoginPage.tsx`
- **Category**: security
- **Impact**: Brute force vulnerability

**Description**

No client-side rate limiting on login attempts.

**Recommendation**

Add rate limiting:

```tsx
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000;

const [attempts, setAttempts] = useState(0);
const [lockedUntil, setLockedUntil] = useState<number | null>(null);

const handleLogin = async () => {
  if (lockedUntil && Date.now() < lockedUntil) {
    toast.error(`Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)}s`);
    return;
  }
  
  try {
    await login(credentials);
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

### LOW AUTH-WS-013: Console.log Statements in Auth Code

- **File**:
  - `mobile/hooks/useAuthCheck.ts:45-50`
  - `mobile/services/websocket.service.ts:60-120`
  - `dashboard/src/hooks/useWebSocket.ts:40-80`
- **Category**: code-quality
- **Impact**: Performance, security

**Description**

Multiple debug console.log statements in auth-related code.

**Recommendation**

Remove or wrap in `__DEV__` checks.

---

## Cross-References

| Finding | Related |
|---------|---------|
| AUTH-WS-001 | MOB-HK-001, DASH-PG-003 |
| AUTH-WS-002 | MOB-API-003, DATA-001 |
| AUTH-WS-003 | MOB-HK-004 |
| AUTH-WS-004 | DASH-PG-002 |
| AUTH-WS-005 | MOB-HK-001 |
| AUTH-WS-006 | MOB-HK-005 |
| AUTH-WS-007 | MOB-HK-003 |
| AUTH-WS-010 | MOB-HK-011, DASH-PG-010 |
| AUTH-WS-011 | MOB-HK-010 |
| AUTH-WS-012 | MOB-NA-010 |