# Dashboard Pages Code Review

**Workspace**: dashboard
**Domain**: pages
**Date**: 2026-04-07
**Files Covered**: 15+ page and component files

## Summary

The dashboard is a React SPA using React Router v7, TanStack Query for data fetching, and Zustand for state management. It provides admin functionality for complaints, promos, wallets, notifications, and profile management. The code is well-structured with proper loading/error states. However, there are issues with missing pagination, missing form validation, hardcoded URLs, console.log statements, and missing error boundaries.

## Files Covered

| File | Status | Notes |
|------|--------|-------|
| `pages/dashboard/DashboardPage.tsx` | Issues found | Missing error handling |
| `pages/login/LoginPage.tsx | Clean | Good validation |
| `pages/profile/ProfilePage.tsx` | Issues found | Missing validation |
| `pages/complaints/ComplaintsPage.tsx` | Issues found | Missing pagination |
| `pages/complaints/components/ComplaintDetailModal.tsx` | Issues found | Missing validation |
| `pages/notifications/NotificationsPage.tsx` | Issues found | Missing pagination |
| `pages/notifications/components/SendNotificationModal.tsx` | Issues found | Missing validation |
| `pages/promos/PromosPage.tsx` | Issues found | Missing pagination |
| `pages/promos/components/CreatePromoModal.tsx` | Issues found | Missing validation |
| `pages/wallets/WalletsPage.tsx` | Issues found | Missing pagination |
| `components/layout/ProtectedAppLayout.tsx` | Clean | Simple wrapper |
| `components/shared/ProtectedRoute.tsx` | Issues found | Missing role check |
| `stores/authStore.ts` | Issues found | Missing persistence |
| `stores/notificationStore.ts` | Clean | Good state management |
| `hooks/useWebSocket.ts` | Issues found | Console.log, hardcoded URL |
| `hooks/useTokenRefresh.ts` | Issues found | Missing error handling |
| `main.tsx` | Clean | Good setup |

---

## HIGH FINDINGS

### HIGH DASH-PG-001: ProtectedRoute Missing Role-Based Access Control

- **File**: `dashboard/src/components/shared/ProtectedRoute.tsx:20-35`
- **Category**: security
- **Impact**: Unauthorized access to admin pages

**Description**

The protected route only checks if the user is authenticated, not if they have the correct role. A regular user (RIDER/DRIVER) who somehow gets a valid token could access the admin dashboard.

```tsx
// Sync auth to Zustand on first successful fetch
useEffect(() => {
  if (isSuccess && data && !isAuthenticated) {
    if (data.role === 'ADMIN' || data.role === 'SUPPORT') {
      setUser(data);
    }
  }
}, [isSuccess, data, isAuthenticated, setUser]);

// But the redirect check doesn't verify role
if (isError || !isAuthenticated) {
  return <Navigate to="/login" state={{ from: location }} replace />;
}
```

The role check happens in the sync effect, but if `setUser` is never called (because role is not ADMIN/SUPPORT), `isAuthenticated` remains false and the user is redirected. However, this logic is implicit and fragile.

**Recommendation**

Make role check explicit:
```tsx
export function ProtectedRoute({ 
  children, 
  allowedRoles = ['ADMIN', 'SUPPORT'] 
}: { 
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, isAuthenticated, setUser, clear } = useAuthStore();
  // ...

  // Explicit role check
  if (isAuthenticated && user && !allowedRoles.includes(user.role)) {
    clear();
    return <Navigate to="/login" state={{ error: 'unauthorized_role' }} replace />;
  }

  if (isError || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

---

### HIGH DASH-PG-002: Auth Store Missing Persistence

- **File**: `dashboard/src/stores/authStore.ts`
- **Category**: bug
- **Impact**: User logged out on page refresh

**Description**

The auth store doesn't persist state. If the user refreshes the page, they appear logged out even though they have valid tokens in localStorage/cookies.

```tsx
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clear: () => set({ user: null, isAuthenticated: false }),
}));
```

**Recommendation**

Persist to localStorage:
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

### HIGH DASH-PG-003: WebSocket Missing Authentication

- **File**: `dashboard/src/hooks/useWebSocket.ts:30-50`
- **Category**: security
- **Impact**: Unauthenticated WebSocket connections

**Description**

The WebSocket connects without passing authentication credentials. The server may reject the connection or accept it without identity verification.

```tsx
const ws = new WebSocket(WS_URL);
// No auth token passed
```

**Recommendation**

Pass auth token in URL or send after connection:
```tsx
const token = localStorage.getItem('accessToken');
const url = token ? `${WS_URL}?token=${token}` : WS_URL;
const ws = new WebSocket(url);

// Or send auth message after connection
ws.onopen = () => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    ws.send(JSON.stringify({ type: 'auth', token }));
  }
  // ...
};
```

---

## MEDIUM FINDINGS

### MEDIUM DASH-PG-004: Missing Pagination on All List Pages

- **File**: `ComplaintsPage.tsx`, `NotificationsPage.tsx`, `PromosPage.tsx`, `WalletsPage.tsx`
- **Category**: performance
- **Impact**: Performance degradation with large datasets

**Description**

All list pages fetch all records without pagination:

```tsx
// ComplaintsPage.tsx
const { data: complaints } = useGetComplaints(filters.status);

// NotificationsPage.tsx
const { data: myNotifications } = useGetMyNotifications();

// PromosPage.tsx
const { data: promos } = useGetPromos(filters.status);

// WalletsPage.tsx
const { data: withdrawals } = useGetWithdrawals(filters.status);
```

**Recommendation**

Add pagination parameters:
```tsx
interface PaginationParams {
  cursor?: string;
  limit?: number;
}

const { data } = useGetComplaints({ 
  status: filters.status, 
  limit: 20, 
  cursor: pageCursor 
});
```

---

### MEDIUM DASH-PG-005: CreatePromoModal Missing Validation

- **File**: `dashboard/src/pages/promos/components/CreatePromoModal.tsx:20-60`
- **Category**: bug
- **Impact**: Invalid data submitted

**Description**

Form validation is minimal - only `required` attributes on inputs. No validation for:
- Code format/length
- Value range (e.g., percentage should be 1-100)
- Date range (validUntil should be after validFrom)
- Duplicate code check

```tsx
<Input
  id="code"
  value={code}
  onChange={(e) => setCode(e.target.value.toUpperCase())}
  placeholder="SUMMER2026"
  required // Only HTML5 validation
/>
```

**Recommendation**

Add comprehensive validation:
```tsx
const validateForm = (): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  if (code.length < 4 || code.length > 20) {
    errors.code = 'Code must be 4-20 characters';
  }
  if (!/^[A-Z0-9]+$/.test(code)) {
    errors.code = 'Code must contain only letters and numbers';
  }
  if (type === 'PERCENTAGE' && (parseFloat(value) < 1 || parseFloat(value) > 100)) {
    errors.value = 'Percentage must be between 1 and 100';
  }
  if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)) {
    errors.validUntil = 'End date must be after start date';
  }
  return errors;
};
```

---

### MEDIUM DASH-PG-006: ComplaintDetailModal Missing Comment Validation

- **File**: `dashboard/src/pages/complaints/components/ComplaintDetailModal.tsx:60-80`
- **Category**: bug
- **Impact**: Empty comments submitted

**Description**

Comments can be submitted with only whitespace:
```tsx
const handleAddComment = () => {
  if (!comment.trim()) return; // Good - trims whitespace
  addComment({ id: complaint.id, data: { comment: comment.trim(), isInternal: false } });
};
```

Actually this is handled correctly. But the resolution textarea has no validation:
```tsx
<Button onClick={handleUpdateStatus} disabled={!newStatus || isUpdating}>
  {/* Resolution not validated */}
</Button>
```

**Recommendation**

Validate resolution when resolving:
```tsx
const handleUpdateStatus = () => {
  if (!newStatus) return;
  if (newStatus === 'RESOLVED' && !resolution.trim()) {
    alert('Resolution notes are required when resolving a complaint');
    return;
  }
  // ...
};
```

---

### MEDIUM DASH-PG-007: ProfilePage Missing Form Validation

- **File**: `dashboard/src/pages/profile/ProfilePage.tsx:50-80`
- **Category**: bug
- **Impact**: Invalid profile data

**Description**

Profile form has no validation for email format, phone format, or name length:
```tsx
<Input
  id="email"
  type="email"
  value={isEditing ? formData.email : profile.email}
  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
  disabled={!isEditing}
/>
```

**Recommendation**

Add validation similar to login page.

---

### MEDIUM DASH-PG-008: Token Refresh Missing Error Handling

- **File**: `dashboard/src/hooks/useTokenRefresh.ts:10-25`
- **Category**: bug
- **Impact**: Silent auth failures

**Description**

Token refresh errors are logged but not handled:
```tsx
const refreshToken = async () => {
  try {
    await api.post('/auth/refresh');
  } catch (error) {
    console.error('Token refresh failed:', error);
    // No action - user stays "authenticated" with expired token
  }
};
```

**Recommendation**

Dispatch unauthorized event on failure:
```tsx
const refreshToken = async () => {
  try {
    await api.post('/auth/refresh');
  } catch (error) {
    console.error('Token refresh failed:', error);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
};
```

---

### MEDIUM DASH-PG-009: WebSocket Console.log Statements

- **File**: `dashboard/src/hooks/useWebSocket.ts:40-80`
- **Category**: code-quality
- **Impact**: Performance, noise

**Description**

Multiple console.log statements:
```tsx
console.log('[WebSocket] Connected');
console.log(`[WebSocket] Auto-subscribed to user:${userId}`);
console.log(`[WebSocket] Subscribed to ${channel}:${id}`);
console.log(`[WebSocket] Unsubscribed from ${channel}:${id}`);
console.log('[WebSocket] Disconnected');
```

**Recommendation**

Remove or wrap in development check.

---

### MEDIUM DASH-PG-010: Hardcoded WebSocket URL

- **File**: `dashboard/src/hooks/useWebSocket.ts:15`
- **Category**: code-quality
- **Impact**: Configuration issues

**Description**

```tsx
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001/ws';
```

The fallback URL uses localhost which won't work in production deployments.

**Recommendation**

Make fallback configurable or throw error if not set:
```tsx
const WS_URL = import.meta.env.VITE_WS_URL;
if (!WS_URL) {
  console.warn('VITE_WS_URL not set, WebSocket features disabled');
}
```

---

### MEDIUM DASH-PG-011: Notifications Page Tab Switching Race Condition

- **File**: `dashboard/src/pages/notifications/NotificationsPage.tsx:40-55`
- **Category**: bug
- **Impact**: Stale data displayed

**Description**

When switching between "my" and "all" tabs, both queries can be in flight. The effect that syncs to the store may use stale data:

```tsx
useEffect(() => {
  const fetchedNotifications = activeTab === 'my' ? myNotifications : allNotifications;
  if (fetchedNotifications) {
    setNotifications(fetchedNotifications.map((n) => ({...})));
  }
}, [activeTab, myNotifications, allNotifications, setNotifications]);
```

If `myNotifications` is stale when switching to "all", the effect may run with wrong data.

**Recommendation**

Use separate stores or track loading state per tab:
```tsx
const [myNotifications, setMyNotifications] = useState<Notification[]>([]);
const [allNotifications, setAllNotifications] = useState<Notification[]>([]);

// Don't sync to a single store - use the data directly
const displayedNotifications = activeTab === 'my' ? myNotifications : allNotifications;
```

---

## LOW FINDINGS

### LOW DASH-PG-012: Missing Error Boundaries

- **File**: All page components
- **Category**: bug
- **Impact**: Uncaught errors crash app

**Description**

No error boundaries wrap page components. A runtime error in any component will crash the entire app.

**Recommendation**

Add error boundary:
```tsx
// In router
{
  path: '/complaints',
  element: <ErrorBoundary><ComplaintsPage /></ErrorBoundary>,
}
```

---

### LOW DASH-PG-013: Profile Image Upload Missing File Type Validation

- **File**: `dashboard/src/pages/profile/ProfilePage.tsx:60-75`
- **Category**: bug
- **Impact**: Invalid file types uploaded

**Description**

File type validation exists but is minimal:
```tsx
if (!file.type.startsWith('image/')) {
  alert('Please select an image file');
  return;
}
```

This allows any image type, including potentially malicious files.

**Recommendation**

Validate specific types:
```tsx
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
if (!ALLOWED_TYPES.includes(file.type)) {
  alert('Only JPG, PNG, GIF, and WebP images are allowed');
  return;
}
```

---

### LOW DASH-PG-014: Missing Loading States for Mutations

- **File**: `ComplaintDetailModal.tsx`, `SendNotificationModal.tsx`
- **Category**: ux
- **Impact**: User doesn't know action is processing

**Description**

Some mutation buttons don't show loading state:
```tsx
<Button onClick={handleAddComment} disabled={!comment.trim() || isCommenting} size="sm">
  {isCommenting && <Loader2 size={14} className="animate-spin" />}
  Add Comment
</Button>
```

This is handled correctly. However, the status update button text doesn't change:
```tsx
<Button onClick={handleUpdateStatus} disabled={!newStatus || isUpdating}>
  {isUpdating && <Loader2 size={14} className="animate-spin" />}
  Update Status
</Button>
```

**Recommendation**

Add loading text:
```tsx
{isUpdating ? 'Updating...' : 'Update Status'}
```

---

### LOW DASH-PG-015: Dashboard Page Missing Error State for All Queries

- **File**: `dashboard/src/pages/dashboard/DashboardPage.tsx:25-35`
- **Category**: bug
- **Impact**: Partial error states

**Description**

Only complaints error is handled:
```tsx
if (complaintsError) {
  return <ErrorState message="Failed to load dashboard data" onRetry={refetchComplaints} />;
}
```

Promos and withdrawals errors are not caught.

**Recommendation**

Check all queries:
```tsx
const hasError = complaintsError || promosError || withdrawalsError;
if (hasError) {
  return <ErrorState message="Failed to load dashboard data" onRetry={refetchAll} />;
}
```

---

### LOW DASH-PG-016: Missing RTL Text Direction for Mixed Content

- **File**: All pages
- **Category**: ux
- **Impact**: Mixed RTL/LTR text issues

**Description**

The app is RTL but some content (like email addresses, phone numbers) should be LTR:
```tsx
<Input
  id="email"
  type="email"
  value={isEditing ? formData.email : profile.email}
  // Should have dir="ltr" for email
/>
```

**Recommendation**

Add `dir="ltr"` for LTR content:
```tsx
<Input
  id="email"
  type="email"
  dir="ltr"
  className="text-left"
  // ...
/>
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| DASH-PG-001 | MOB-NA-001 (Auth guard race conditions) |
| DASH-PG-002 | MOB-ST-003 (Trip store persistence) |
| DASH-PG-003 | MOB-HK-001 (WebSocket auth) |
| DASH-PG-004 | MOB-API-008 (Trip API pagination) |
| DASH-PG-005 | MOB-S-006 (Form validation) |
| DASH-PG-008 | MOB-API-003 (Token refresh race) |
| DASH-PG-010 | MOB-HK-011 (Hardcoded WS URL) |
| DASH-PG-012 | MOB-S-003 (Error boundaries) |