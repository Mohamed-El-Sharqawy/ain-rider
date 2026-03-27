# 911 Ain Rider — Mobile App Architecture Plan

Comprehensive implementation plan for the React Native / Expo mobile application that consumes the ain-rider backend microservices.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Feature Modules](#4-feature-modules)
5. [Screen Inventory](#5-screen-inventory)
6. [Navigation Architecture](#6-navigation-architecture)
7. [State Management](#7-state-management)
8. [Networking Layer](#8-networking-layer)
9. [WebSocket Real-Time Layer](#9-websocket-real-time-layer)
10. [Authentication Flow](#10-authentication-flow)
11. [Geolocation & Maps](#11-geolocation--maps)
12. [Push Notifications](#12-push-notifications)
13. [Offline & Error Handling](#13-offline--error-handling)
14. [Security Considerations](#14-security-considerations)
15. [Performance & Scalability](#15-performance--scalability)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment Pipeline](#17-deployment-pipeline)

---

## 1. Overview

The mobile app serves **two user roles** from a single codebase:

| Role | Primary Actions |
|------|----------------|
| **Rider** | Request trips, track driver, pay, rate |
| **Driver** | Go online, accept trips, navigate, collect payment |

> [!IMPORTANT]
> **Core Non-Functional Requirement: Robust Background Operation**
> Ain Rider is a ride-hailing application. A rider may request a trip and switch to another app while waiting for a match. A driver must receive trip assignments while the app is backgrounded. Background location, WebSocket persistence, and push notifications must all remain active when the app is not in the foreground. This is not optional — it is the same baseline expectation users have from Uber and Careem. Any screen or feature that assumes the app is always foregrounded is a design defect.

The app talks to the backend through:
- **REST API** → `api-gateway:3000` (all CRUD operations)
- **WebSocket** → `websocket-server:3001` (real-time events: trip matching, location tracking, notifications)

### Backend Infrastructure (Docker Compose — 17 containers)

| Container | Image | Port(s) | Purpose |
|-----------|-------|---------|---------|
| `ain-rider-postgres` | timescale/timescaledb-ha:pg17 | 5433→5432 | PostgreSQL + TimescaleDB (5 databases) |
| `ain-rider-pgbouncer-auth` | edoburu/pgbouncer | 5434→5432 | Connection pool → `ainrider_auth` |
| `ain-rider-pgbouncer-admin` | edoburu/pgbouncer | 5435→5432 | Connection pool → `ainrider_admin` |
| `ain-rider-pgbouncer-trip` | edoburu/pgbouncer | 5436→5432 | Connection pool → `ainrider_trip` |
| `ain-rider-pgbouncer-payment` | edoburu/pgbouncer | 5437→5432 | Connection pool → `ainrider_payment` |
| `ain-rider-pgbouncer-location` | edoburu/pgbouncer | 5438→5432 | Connection pool → `ainrider_location` |
| `ain-rider-redis-1..6` | redis:7.4-alpine | 6379–6384 | Redis Cluster (3 masters + 3 replicas) |
| `ain-rider-nats-1..3` | nats:2.10-alpine | 4222–4224, 8222–8224 | NATS JetStream cluster (quorum replication) |
| `ain-rider-minio` | minio/minio | 9000 (API), 9001 (Console) | S3-compatible object storage (profiles, docs) |

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|----------|
| Framework | Expo SDK 55 + React Native 0.83 | Managed workflow, OTA updates |
| Language | TypeScript 5.9 | Type safety matching backend types |
| Styling | **NativeWind v4** (Tailwind for RN) | Utility-first CSS, matches web paradigm |
| Navigation | Expo Router (file-based) | Deep linking, type-safe routes |
| State | Zustand + React Query (TanStack) | Lightweight global state + server cache |
| HTTP Client | Axios | Interceptors for auth, retries |
| WebSocket | **`reconnecting-websocket`** | Auto-reconnect with backoff, drop-in WebSocket replacement |
| Maps (Dev) | **`@maplibre/maplibre-react-native`** + OpenStreetMap tiles | 🆓 Free, no API key needed during development |
| Maps (Prod) | `react-native-maps` (Google Maps) | Swap in before production deploy |
| Routing/Geocoding (Dev) | **OSRM** (Open Source Routing Machine) / **Nominatim** | 🆓 Free route polylines + address search |
| Routing/Geocoding (Prod) | Google Directions API + Google Places | Swap in before production deploy |
| Location | `expo-location` | Background GPS for drivers |
| Notifications | `expo-notifications` + FCM/APNs | Push alerts |
| Storage | `expo-secure-store` (tokens) + MMKV (data) | Encrypted token storage |
| Forms | React Hook Form + Zod | Validation matching backend DTOs |
| Animations | **React Native Reanimated 3** | UI-thread animations for smooth driver markers, pulsing search, transitions |
| Gestures | **React Native Gesture Handler** | Swipe-to-cancel, drag bottom sheets, pull-to-refresh |
| Bottom Sheet | **`@gorhom/bottom-sheet`** | Built on Reanimated 3 + Gesture Handler, industry standard for ride-hailing UIs |
| Icons | `@expo/vector-icons` | Comprehensive icon set included with Expo |

> [!IMPORTANT]
> **Free-First Strategy**: During development, all paid services (Google Maps, Google Directions, Google Places) are replaced with free alternatives (OpenStreetMap, MapLibre, OSRM, Nominatim). The map/routing layer is abstracted behind a provider interface so swapping to Google is a config change before production deployment.

---

## 3. Project Structure

```
mobile/
├── app/                           # Expo Router file-based routing
│   ├── (auth)/                    # Auth screens (unauthenticated)
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── otp-verify.tsx
│   ├── (rider)/                   # Rider tab group
│   │   ├── (tabs)/
│   │   │   ├── home.tsx           # Map + request ride
│   │   │   ├── activity.tsx       # Trip history
│   │   │   ├── wallet.tsx         # Payment methods
│   │   │   └── profile.tsx        # Settings
│   │   ├── trip/
│   │   │   ├── [id].tsx           # Active trip tracking
│   │   │   └── rate.tsx           # Post-trip rating
│   │   └── _layout.tsx
│   ├── (driver)/                  # Driver tab group
│   │   ├── (tabs)/
│   │   │   ├── home.tsx           # Go online / incoming requests
│   │   │   ├── earnings.tsx       # Daily/weekly earnings
│   │   │   ├── trips.tsx          # Trip history
│   │   │   └── profile.tsx        # Vehicle & settings
│   │   ├── trip/
│   │   │   ├── [id].tsx           # Active trip navigation
│   │   │   └── collect.tsx        # Cash collection screen
│   │   └── _layout.tsx
│   ├── _layout.tsx                # Root layout (providers)
│   └── index.tsx                  # Entry redirect
├── src/
│   ├── api/                       # API layer
│   │   ├── client.ts              # Axios instance config
│   │   ├── auth.api.ts            # Auth endpoints
│   │   ├── trip.api.ts            # Trip endpoints
│   │   ├── location.api.ts        # Location endpoints
│   │   ├── payment.api.ts         # Payment endpoints
│   │   └── types.ts               # API response types
│   ├── hooks/                     # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useTrip.ts
│   │   ├── useLocation.ts
│   │   ├── useWebSocket.ts
│   │   └── useNotifications.ts
│   ├── stores/                    # Zustand stores
│   │   ├── auth.store.ts
│   │   ├── trip.store.ts
│   │   ├── location.store.ts
│   │   └── notification.store.ts
│   ├── services/                  # Non-UI business logic
│   │   ├── websocket.service.ts   # WS connection (reconnecting-websocket)
│   │   ├── location.service.ts    # Background location
│   │   ├── notification.service.ts
│   │   ├── map.provider.ts        # Map provider interface (OSM ↔ Google swap)
│   │   ├── osm.provider.ts        # OpenStreetMap/OSRM/Nominatim (dev)
│   │   └── google.provider.ts     # Google Maps/Directions/Places (prod)
│   ├── components/                # Shared components
│   │   ├── ui/                    # Buttons, inputs, cards (NativeWind styled)
│   │   ├── maps/                  # Map markers, overlays (Reanimated 3)
│   │   ├── trip/                  # Trip-specific components
│   │   └── layout/                # Headers, @gorhom/bottom-sheet wrappers
│   ├── constants/                 # App constants
│   │   ├── config.ts              # API URLs, keys
│   │   └── theme.ts               # Colors, typography
│   ├── utils/                     # Utility functions
│   │   ├── format.ts              # Currency, date, distance
│   │   └── geo.ts                 # Coordinate helpers
│   └── types/                     # Global TypeScript types
│       ├── user.types.ts
│       ├── trip.types.ts
│       └── navigation.types.ts
├── assets/                        # Images, fonts, icons
├── docs/                          # This documentation
├── app.json                       # Expo config
├── package.json
└── tsconfig.json
```

---

## 4. Feature Modules

### 4.1 Authentication Module
- Email + password login/register
- Phone number OTP verification (future)
- JWT token management (access + refresh)
- Auto-refresh on 401 responses
- Secure token storage via `expo-secure-store`
- Role-based routing (Rider → rider tabs, Driver → driver tabs)

### 4.2 Rider Module
- **Home**: Map view with pickup/dropoff selection, fare estimation, ride request
- **Trip Tracking**: Real-time driver location on map, ETA, trip status updates
- **Trip History**: Past trips with details, receipts, ratings
- **Payment**: Payment method management (Cash/Card/Wallet), promo codes
- **Rating**: Post-trip driver rating

### 4.3 Driver Module
- **Home**: Toggle online/offline, incoming trip requests with accept/decline
- **Active Trip**: Turn-by-turn navigation, rider pickup, trip progress
- **Earnings**: Daily/weekly/monthly revenue breakdown
- **Cash Collection**: Confirm cash payment from rider
- **Profile**: Vehicle management, documents, license

### 4.4 Shared Module
- **Profile**: Edit personal info, profile image upload (MinIO)
- **Notifications**: In-app notification center
- **Support**: SOS emergency button, complaint filing
- **Settings**: Language, theme, notification preferences

---

## 5. Screen Inventory

### Auth Screens (Unauthenticated)
| Screen | Description |
|--------|------------|
| Login | Email + password form |
| Register | Full registration form with role selection |
| Forgot Password | Email-based password reset |
| OTP Verify | Phone verification (future) |

### Rider Screens
| Screen | Description |
|--------|------------|
| Rider Home | Map with search bar, pickup/dropoff pins |
| Confirm Ride | Vehicle type, estimated fare, payment method, promo code |
| Searching | Animated searching state while matching |
| Trip Active | Live map with driver location, ETA, trip status |
| Trip Completed | Fare summary, receipt |
| Rate Driver | Star rating + comment |
| Trip History | Scrollable list of past trips |
| Trip Detail | Full trip breakdown (route, fare, payment) |
| Wallet | Balance, transaction history |
| Add Payment | Add card, select default method |
| Profile | Edit name, phone, email, profile picture |

### Driver Screens
| Screen | Description |
|--------|------------|
| Driver Home | Map with online/offline toggle |
| Incoming Trip | Bottom sheet with trip details, accept/decline timer |
| Navigate to Pickup | Map route to rider pickup location |
| Trip In Progress | Map route to dropoff, trip timer |
| Trip Completed | Fare summary |
| Cash Collection | Confirm cash received from rider |
| Rate Rider | Star rating |
| Earnings Dashboard | Revenue charts, daily breakdown |
| Trip History | Past trips list |
| Vehicle Management | Add/edit vehicle details, upload photos |
| Documents | Upload license, registration |

---

## 6. Navigation Architecture

```
Root Stack
├── (auth) — Auth Group (no bottom tabs)
│   ├── login
│   ├── register
│   ├── forgot-password
│   └── otp-verify
│
├── (rider) — Rider Group
│   ├── (tabs) — Bottom Tab Navigator
│   │   ├── home         (MapPin icon)
│   │   ├── activity     (Clock icon)
│   │   ├── wallet       (Wallet icon)
│   │   └── profile      (User icon)
│   └── trip/
│       ├── [id]         (Active trip modal)
│       └── rate         (Rating modal)
│
└── (driver) — Driver Group
    ├── (tabs) — Bottom Tab Navigator
    │   ├── home         (Wheel icon)
    │   ├── earnings     (TrendingUp icon)
    │   ├── trips        (List icon)
    │   └── profile      (User icon)
    └── trip/
        ├── [id]         (Active trip modal)
        └── collect      (Cash collection modal)
```

---

## 7. State Management

### Zustand Stores

```typescript
// auth.store.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterDTO) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

// trip.store.ts
interface TripState {
  activeTrip: Trip | null;
  tripStatus: TripStatus;
  driverLocation: LatLng | null;
  estimatedArrival: number | null;
  setActiveTrip: (trip: Trip) => void;
  updateDriverLocation: (location: LatLng) => void;
  clearTrip: () => void;
}

// location.store.ts
interface LocationState {
  currentLocation: LatLng | null;
  isTracking: boolean;
  heading: number | null;
  speed: number | null;
  startTracking: () => void;
  stopTracking: () => void;
}
```

### React Query (Server State)

```typescript
// Trip queries
useQuery(['trip', tripId], () => tripApi.getTrip(tripId));
useQuery(['trips', 'history'], () => tripApi.getTripHistory());
useMutation((data) => tripApi.createTrip(data));

// Payment queries
useQuery(['payments', tripId], () => paymentApi.getPayment(tripId));

// User queries
useQuery(['user', 'me'], () => authApi.getMe());
```

---

## 8. Networking Layer

### Axios Client Configuration

```typescript
// src/api/client.ts
const apiClient = axios.create({
  baseURL: API_BASE_URL,     // https://api.ainrider.com or http://localhost:3000
  timeout: 15000,
  withCredentials: true,      // Send cookies automatically
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken(); // from secure-store
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await refreshAccessToken();
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);
```

> **Note on Auth Strategy**: The backend uses `httpOnly` cookies for web clients. For mobile, we'll need to use **Bearer tokens** instead since `httpOnly` cookies don't work well with React Native's networking. The backend should expose tokens in the response body alongside setting cookies, or a mobile-specific auth endpoint should be added.

---

## 9. WebSocket Real-Time Layer

### Connection Manager (using `reconnecting-websocket`)

```typescript
// src/services/websocket.service.ts
import ReconnectingWebSocket from 'reconnecting-websocket';

class WebSocketService {
  private ws: ReconnectingWebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  connect(token: string) {
    // reconnecting-websocket handles all reconnection logic automatically
    this.ws = new ReconnectingWebSocket(`${WS_BASE_URL}/ws?token=${token}`, [], {
      maxReconnectionDelay: 30000,    // Max 30s between retries
      minReconnectionDelay: 1000,     // Start with 1s
      reconnectionDelayGrowFactor: 2, // Exponential backoff
      maxRetries: Infinity,           // Never stop trying
      connectionTimeout: 10000,       // 10s connection timeout
    });

    this.ws.onopen = () => this.onConnected();
    this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
    this.ws.onclose = () => this.stopHeartbeat();
    this.ws.onerror = (error) => this.handleError(error);
  }

  subscribe(channel: string, id: string) {
    this.send({ type: 'subscribe', channel, id });
  }

  // Heartbeat every 25 seconds
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  }

  disconnect() {
    this.stopHeartbeat();
    this.ws?.close();  // Stops reconnection attempts
  }
}
```

### Channel Subscriptions by Role

| Role | Channel | ID Format | Events Received |
|------|---------|-----------|-----------------|
| Rider | `trip` | `{tripId}:rider` | `trip_matched`, `trip_started`, `trip_completed`, `driver_location_update` |
| Rider | `user` | `{userId}` | `notification` |
| Driver | `driver` | `{driverId}` | `trip_assigned`, `location_update`, `trip_started`, `trip_completed` |
| Driver | `user` | `{userId}` | `notification` |

### Event Handling Flow

```
WebSocket Message Received
       │
       ├─ trip_matched      → Update trip store → Navigate to active trip screen
       ├─ trip_assigned      → Show incoming trip bottom sheet (driver)
       ├─ trip_started       → Update trip status to IN_PROGRESS
       ├─ trip_completed     → Navigate to rating/payment screen
       ├─ trip_cancelled     → Show cancellation alert → Return to home
       ├─ driver_location_update → Update driver marker on map (rider view)
       ├─ notification       → Show in-app banner + badge update
       ├─ sos_alert         → (driver) Show SOS indicator
       └─ pong              → Reset heartbeat timer
```

---

## 10. Authentication Flow

### Mobile-Specific Considerations

Since `httpOnly` cookies don't work reliably on mobile, the recommended auth approach:

```
1. POST /auth/login → response body includes { accessToken, refreshToken, user }
2. Store accessToken in expo-secure-store (encrypted)
3. Store refreshToken in expo-secure-store (encrypted)
4. Attach accessToken as Bearer header on every request
5. On 401 → POST /auth/refresh with refreshToken → new accessToken
6. On refresh failure → force logout → navigate to login
```

### Token Lifecycle

```
Access Token:  15 min (short-lived, in-memory + secure-store)
Refresh Token: 7 days (secure-store only, sent to /auth/refresh)

App Open → Read tokens from secure-store
        → Validate access token (check expiry locally)
        → If expired: call /auth/refresh
        → If refresh fails: redirect to login
        → If valid: proceed to main app
```

---

## 11. Geolocation & Maps

### Rider Location
- Request `foreground` permission on ride request
- Get current location for pickup pin default
- Show map with pickup/dropoff markers
- Track driver on map during active trip via WebSocket events

### Driver Location (Background GPS)
- Request `background` permission on "Go Online"
- Stream location every 3 seconds to `POST /location/update`
- Continue in background (critical for active trips)
- Battery optimization: reduce to 10s interval when idle, 3s during trips

### Map Features (Free-First Strategy)

**Development (Free):**
- **MapLibre GL** via `@maplibre/maplibre-react-native` — open-source map rendering
- **OpenStreetMap tiles** — free raster tiles, no API key
- **OSRM** — free route polylines (self-hosted or public demo server)
- **Nominatim** — free geocoding/address search

**Production (Swap Before Deploy):**
- **Google Maps** via `react-native-maps` — production-grade rendering
- **Google Directions API** — accurate ETA and routing
- **Google Places API** — address autocomplete

**Map Abstraction Swap Rule:**
```typescript
// src/services/map.provider.ts
interface MapProvider {
  getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult>;
  geocode(address: string): Promise<LatLng>;
  reverseGeocode(location: LatLng): Promise<string>;
  searchPlaces(query: string, near: LatLng): Promise<Place[]>;
}

// Use ENV to toggle:
// MAP_PROVIDER=osm (dev) → MAP_PROVIDER=google (prod)
export const mapProvider: MapProvider = 
  MAP_PROVIDER === 'google' ? new GoogleMapProvider() : new OSMMapProvider();
```

> [!CAUTION]
> **Map Swap Rule**: Swapping from OSM to Google Maps must ONLY touch `google.provider.ts` and the `MAP_PROVIDER` env variable. If a PR modifies any other file to make the swap work, the abstraction is broken and the PR must not merge until the abstraction is fixed.

**Map UI (both providers):**
- Animated camera follow during trips
- "Nearby drivers" preview on rider home (via `GET /location/nearby`)

### Animations with Reanimated 3

All map and UI animations run on the **UI thread** via Reanimated 3 for 60fps smoothness:

**Driver marker smooth movement:**
```typescript
function DriverMarker({ coordinate }) {
  const lat = useSharedValue(coordinate.lat);
  const lng = useSharedValue(coordinate.lng);

  useEffect(() => {
    lat.value = withTiming(coordinate.lat, { duration: 1000 });
    lng.value = withTiming(coordinate.lng, { duration: 1000 });
  }, [coordinate]);
}
```

**Bottom sheet slide-up on ride match (via @gorhom/bottom-sheet):**
```typescript
import BottomSheet from '@gorhom/bottom-sheet';

function RideMatchSheet({ matched }) {
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (matched) bottomSheetRef.current?.expand();
    else bottomSheetRef.current?.close();
  }, [matched]);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={['40%', '80%']}>
      <DriverCard />
    </BottomSheet>
  );
}
```

**Pulsing ping while searching for driver:**
```typescript
function SearchingPulse() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.4], [1, 0.3]),
  }));

  return <Animated.View style={animatedStyle} className="w-16 h-16 rounded-full bg-primary" />;
}
```

---

## 12. Push Notifications

### Notification Types

| Event | Title | Body | Action |
|-------|-------|------|--------|
| Trip Matched | "Driver Found!" | "Your driver is on the way" | Open active trip |
| Trip Assigned (Driver) | "New Trip Request" | "Rider nearby - tap to accept" | Open incoming trip |
| Trip Started | "Trip Started" | "You're on your way!" | Open active trip |
| Trip Completed | "Trip Completed" | "IQD{fare} - Rate your ride" | Open rating screen |
| Payment Received (Driver) | "Payment Received" | "IQD{amount} added to earnings" | Open earnings |
| SOS Alert (Support) | "Emergency SOS" | "Trip #{id} needs help" | Open SOS panel |

### Implementation
- Register device token via `expo-notifications`
- Send token to backend on login: `POST /auth/device-token`
- Backend sends push via FCM (Android) / APNs (iOS)
- Deep link handling for notification tap → navigate to correct screen

---

## 13. Offline & Error Handling

### Offline Strategy
- **Detect**: Use `@react-native-community/netinfo` to monitor connectivity
- **Queue**: Offline actions queued and replayed on reconnect (e.g., rating submission)
- **Cache**: React Query caches trip history, profile data for offline viewing
- **UI**: Show offline banner, disable network-dependent actions

### Error Handling
- **API Errors**: Centralized in Axios interceptor → Toast notifications
- **WebSocket Errors**: Auto-reconnect with exponential backoff (max 30s)
- **Location Errors**: Fallback to last known location, prompt for permissions
- **Crash Reporting**: Sentry or Bugsnag integration

---

## 14. Security Considerations

| Concern | Solution |
|---------|---------|
| Token storage | `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android) |
| API communication | HTTPS only in production |
| Certificate pinning | SSL pinning for production API domain |
| Root/jailbreak detection | Detect and warn (not block) |
| Screen capture | Prevent screenshots on payment screens |
| Input validation | Zod schemas matching backend DTOs |
| Rate limiting | Backend handles at API Gateway (100 req/min per IP) |

---

## 15. Performance & Scalability

### For 1M+ Users

| Area | Strategy |
|------|----------|
| API calls | React Query caching + stale-while-revalidate |
| Map rendering | Cluster nearby driver markers, limit visible markers to ~50 |
| WebSocket | Single persistent connection per session, channel-based filtering |
| Images | Progressive loading, CDN for profile/vehicle images |
| Bundle size | Code splitting by route group (lazy loading) |
| Location updates | Batching when in background, adaptive frequency |
| Memory | Virtualized lists for trip history, pagination (FlashList deferred to Phase 6) |
| Startup time | Minimal splash-to-interactive time, deferred non-critical loads |
| OTA updates | Expo EAS Update for instant bug fixes without app store review |

### Connection Multiplexing for Scale
- WebSocket server handles real-time; all other calls go through REST
- Backend API Gateway already rate-limits at 100 req/min per IP
- Redis Cluster (6 nodes) handles high-throughput geo lookups
- NATS JetStream provides reliable message delivery for events

---

## 16. Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit Tests | Jest + React Native Testing Library | Components, hooks, utils |
| Integration Tests | MSW (Mock Service Worker) | API layer, auth flow |
| E2E Tests | Detox or Maestro | Critical user journeys |
| Performance | Flipper / React DevTools Profiler | Render cycles, memory |

### Critical Test Flows
1. Register → Login → See home screen (role-based)
2. Rider: Request trip → Match → Track driver → Complete → Rate
3. Driver: Go online → Accept trip → Navigate → Complete → Collect cash
4. Token refresh on expiry
5. WebSocket reconnect on disconnect
6. Offline → Online trip history sync

---

## 17. Deployment Pipeline

```
Feature Branch → PR Review → Merge to main
                                  │
                      ┌───────────┴───────────┐
                      │                       │
               EAS Build (Dev)          EAS Build (Preview)
               Internal Testing         Stakeholder Review
                      │                       │
                      └───────────┬───────────┘
                                  │
                          EAS Build (Production)
                                  │
                      ┌───────────┴───────────┐
                      │                       │
               App Store (iOS)         Play Store (Android)
               TestFlight → Review     Internal → Review
```

### EAS Configuration
- **Development**: Local builds, dev client, hot reload
- **Preview**: Shareable builds for QA
- **Production**: Optimized builds for store submission
- **OTA Updates**: `expo-updates` for instant JavaScript patches
