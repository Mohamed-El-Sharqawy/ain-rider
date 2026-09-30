# 911 Ain Rider — Mobile Implementation Phases

Step-by-step implementation roadmap organized into shipping milestones.

---

> [!CAUTION]
> **Hard Gate**: Phase 2+ cannot start until the backend ships mobile token auth (Bearer tokens in response body instead of httpOnly cookies). See `backend/docs/MOBILE_TOKEN_AUTH.md`.

> [!WARNING]
> **P0 Endpoint Rule**: Any screen that depends on a backend endpoint marked ⚠️ "Needs Backend Addition" in `API_ENDPOINTS.md` must be built with **MSW (Mock Service Worker) mocks** first. Do NOT block mobile development on backend delivery — mock the endpoint, build the UI, swap for the real endpoint when backend ships it.

## Phase 1: Foundation (Week 1-2)
> **Goal**: Project scaffolding, navigation, design system, auth

### Tasks
- [ ] Set up Expo Router file-based navigation structure
- [ ] Install core dependencies:
  - `nativewind` v4, `tailwindcss`, `postcss`
  - `zustand`, `@tanstack/react-query`, `axios`
  - `@maplibre/maplibre-react-native` (free maps for dev)
  - `expo-location`, `expo-secure-store`
  - `react-native-reanimated` (Reanimated 3)
  - `react-native-gesture-handler`
  - `@gorhom/bottom-sheet`
  - `reconnecting-websocket`
  - `@expo/vector-icons`
- [ ] Configure NativeWind v4 (tailwind.config.js, global.css, babel preset)
- [ ] Build design system: colors, typography, spacing, theme (dark/light) using NativeWind
- [ ] Create reusable UI components: Button, Input, Card, Toast (NativeWind styled)
- [ ] Implement map provider abstraction (`map.provider.ts` → `osm.provider.ts` for dev)
- [ ] Implement API client with Axios (interceptors, retry, auth headers)
- [ ] Build auth screens: Login, Register
- [ ] Implement token storage (expo-secure-store) + auto-refresh
- [ ] Role-based routing: redirect Rider→rider tabs, Driver→driver tabs

### Endpoints Used
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

---

## Phase 1.5: Backend Gate (Must Complete Before Phase 2)
> **Goal**: Backend delivers mobile-compatible auth so mobile can make authenticated API calls

### Hard Requirements
- [ ] **Backend ships `POST /auth/login` with tokens in response body** (not just httpOnly cookies)
- [ ] **Backend ships `POST /auth/refresh` accepting Bearer token** (not just cookie)
- [ ] Verify tokens work from React Native Axios client with `Authorization: Bearer <token>` header
- [ ] Document token format and expiry in `backend/docs/MOBILE_TOKEN_AUTH.md`

> If this gate is not passed, Phase 2 screens cannot make authenticated API calls. Mock with MSW as a stopgap only.

---

## Phase 2: Rider Core (Week 3-4)
> **Goal**: Rider can request a trip and track driver in real-time

### Tasks
- [ ] Rider home screen with MapLibre GL map (OpenStreetMap tiles)
- [ ] Pickup/dropoff location search + selection (Nominatim geocoding)
- [ ] Fare estimation UI
- [ ] Trip request flow (confirm → pulsing search animation via Reanimated 3 → matched)
- [ ] WebSocket service using `reconnecting-websocket`: connect, subscribe, heartbeat
- [ ] Active trip screen: live driver marker animated with Reanimated 3 (`withTiming`), ETA, status updates
- [ ] @gorhom/bottom-sheet for trip details, driver card
- [ ] Trip completion screen: fare summary
- [ ] Basic trip history list

### Endpoints Used
- `POST /trips`
- `GET /trips/:id`
- `PATCH /trips/:id/cancel`
- `GET /location/nearby`
- WebSocket: `trip_matched`, `driver_location_update`, `trip_started`, `trip_completed`, `trip_cancelled`

---

## Phase 3: Driver Core (Week 5-6)
> **Goal**: Driver can go online, accept trips, navigate, and complete

### Tasks
- [ ] Driver home screen with online/offline toggle
- [ ] Background location service (3s GPS stream via expo-location)
- [ ] Incoming trip request @gorhom/bottom-sheet with accept/decline + timer
- [ ] Swipe-to-accept gesture (react-native-gesture-handler + Reanimated 3)
- [ ] Route to pickup location (OSRM polyline on MapLibre map)
- [ ] Trip in-progress screen with route to dropoff
- [ ] Trip completion + cash collection confirm
- [ ] Driver trip history

### Endpoints Used
- `POST /match/available`
- `DELETE /match/available/:driverId`
- `POST /location/update`
- `PATCH /trips/:id/status`
- WebSocket: `trip_assigned`, `trip_started`, `trip_completed`

---

## Phase 4: Payments & Ratings (Week 7-8)
> **Goal**: Payment flows, ratings, earnings dashboard

### Tasks
- [ ] Cash payment confirmation flow (driver side)
- [ ] Post-trip rating screen (rider rates driver, driver rates rider)
- [ ] Driver earnings dashboard (daily/weekly/monthly)
- [ ] Payment history list
- [ ] Promo code validation + apply on trip request

### Endpoints Used
- `POST /payments/:id/confirm-cash`
- `POST /trips/:id/rate`
- `GET /payments/history`
- `GET /payments/:tripId`
- `POST /trips/validate-promo`

---

## Phase 5: Profile, Notifications & Safety (Week 9-10)
> **Goal**: Complete user experience with profile, notifications, SOS

### Tasks
- [ ] Profile edit screen (name, phone, email)
- [ ] Profile image upload (MinIO)
- [ ] Driver: Vehicle management, document upload
- [ ] Push notification setup (FCM/APNs via expo-notifications)
- [ ] In-app notification center
- [ ] SOS emergency button
- [ ] Complaint filing
- [ ] Notification preferences (settings)

### Endpoints Used
- `PATCH /auth/me`
- `POST /auth/me/avatar`
- `GET /auth/me/driver`
- `POST /auth/device-token`
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `POST /trips/:id/sos`
- `POST /complaints`

---

## Phase 6: Polish & Scale (Week 11-12)
> **Goal**: Production readiness, performance, testing

### Tasks
- [ ] Offline mode (network detection via `@react-native-community/netinfo`, action queuing)
- [ ] Error handling refinement (retries, user-friendly messages)
- [ ] Performance profiling (`expo-image` caching, memory)
- [ ] Install and integrate **FlashList** for virtualized lists (trip history, earnings, notifications)
- [ ] Map clustering for driver markers
- [ ] Micro-animations polish (Reanimated 3: page transitions, button feedback, loading states)
- [ ] Dark mode support (NativeWind dark: variant)
- [ ] Localization (Arabic + English)
- [ ] E2E test suite (Detox/Maestro)
- [ ] Sentry crash reporting
- [ ] **Swap free services → production services:**
  - [ ] Replace MapLibre → Google Maps (`react-native-maps`)
  - [ ] Replace OSRM → Google Directions API
  - [ ] Replace Nominatim → Google Places API
  - [ ] Implement `google.provider.ts` and set `MAP_PROVIDER=google`
- [ ] EAS build configuration (dev, preview, production)
- [ ] App store assets (screenshots, descriptions)

---

## MVP = Phase 1 + 2 + 3 (~6 weeks)
A functional ride-hailing app where riders can request trips and drivers can accept/complete them with real-time tracking.
