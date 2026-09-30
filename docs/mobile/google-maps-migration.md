# Google Maps Migration Guide

> **Status**: Pre-migration reference document
> **Author**: Architecture team
> **Last updated**: 2026-04-10
> **Scope**: Full stack — mobile (React Native / Expo) + backend (NestJS / Elysia)

---

## Executive Summary

The ain-rider platform currently runs on a fully open-source map stack:

| Layer | Current (OSM Stack) | Target (Google Stack) |
|---|---|---|
| **Map tiles** | OpenStreetMap raster via MapLibre GL | Google Maps SDK (`react-native-maps`) |
| **Routing** | OSRM (self-hosted, Egypt `.osrm` file) | Google Directions API |
| **Geocoding** | Nominatim (`nominatim.openstreetmap.org`) | Google Geocoding API |
| **Place search** | Nominatim search | Google Places API (Autocomplete) |
| **Reverse geocode** | Nominatim reverse | Google Geocoding API (reverse) |
| **Backend ETA/distance** | OSRM HTTP (self-hosted) | Google Directions API or Distance Matrix API |

This document maps **every file, interface, and configuration** that must change, grouped by subsystem, so the migration can be executed methodically with minimal surprises.

---

## Current Architecture

### Abstraction Layer (already exists ✅)

The mobile app already has a **provider-pattern abstraction**:

```
services/map/
├── map.provider.ts      ← Interface (MapProvider)
├── index.ts             ← Factory (reads EXPO_PUBLIC_MAP_PROVIDER)
├── osm.provider.ts      ← Current implementation
├── google.provider.ts   ← Stub (throws "not implemented")
└── polyline.ts          ← Google-format polyline decoder (reusable ✅)
```

The `MapProvider` interface covers:
- `getRoute(origin, destination)` → `RouteResult`
- `geocode(address)` → `GeocodingResult[]`
- `reverseGeocode(location)` → `string`
- `searchPlaces(query, near?)` → `GeocodingResult[]`

**Key insight**: All screens import `mapProvider` from `services/map/index.ts` — they never call OSRM or Nominatim directly. This means the **service layer migration** is largely contained to one file: implementing `google.provider.ts` and switching the env var.

### Map UI Layer (needs full replacement ⚠️)

The UI components use `@maplibre/maplibre-react-native` directly:

```
components/map/
├── MapView.tsx           ← MapLibreGL.MapView + Camera
├── RoutePolyline.tsx     ← MapLibreGL.ShapeSource + LineLayer
├── PickupDropoffPins.tsx ← MapLibreGL.MarkerView
├── LocationMarker.tsx    ← MapLibreGL.MarkerView
├── DriverMarker.tsx      ← MapLibreGL.MarkerView
└── CarMarker.tsx         ← MapLibreGL.MarkerView
```

These components are **tightly coupled to MapLibre's API** — there is no UI abstraction layer. This is the largest migration surface.

### Backend Routing Layer (isolated ✅)

OSRM is used server-side in exactly 3 files:
1. `trip-service/trips.service.ts` → fare estimation
2. `websocket-server/consumers.ts` → real-time ETA enrichment
3. `match-service/service.ts` → driver-to-pickup distance calculation

All three call the same OSRM HTTP API pattern: `{OSRM_URL}/route/v1/driving/{lng},{lat};{lng},{lat}?overview=false`

---

## Migration Inventory

### Layer 1: Mobile — Service Provider (Low effort)

#### [MODIFY] `services/map/google.provider.ts`

Currently a stub. Must implement:

| Method | Google API | Notes |
|---|---|---|
| `getRoute()` | **Directions API** `https://maps.googleapis.com/maps/api/directions/json` | Returns encoded polyline (already have decoder in `polyline.ts`). Precision is 1e-5 same as OSRM ✅ |
| `geocode()` | **Geocoding API** `https://maps.googleapis.com/maps/api/geocode/json` | Response shape differs from Nominatim — map `results[].formatted_address` → `displayName` |
| `reverseGeocode()` | **Geocoding API** (reverse) `latlng={lat},{lng}` | Same endpoint, different param |
| `searchPlaces()` | **Places Autocomplete** (New) `https://maps.googleapis.com/maps/api/place/autocomplete/json` + Place Details | Two-step: autocomplete → details for lat/lng. Or use **Places (New)** Text Search |

**New dependency**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` env var.

**Decision point**: Call Google APIs directly from the client (simpler) or proxy through our API gateway (more secure, avoids key exposure on client)?

> [!WARNING]
> Google API keys in client bundles are extractable. For production, proxy through the backend and restrict the key via HTTP referrer/IP restrictions in Google Cloud Console.

#### [MODIFY] `services/map/index.ts`

No structural change needed — already supports `google` provider via env var. Just ensure the import path resolves correctly.

#### [NO CHANGE] `services/map/map.provider.ts`

The `MapProvider` interface, `LatLng`, `RouteResult`, `GeocodingResult` types are **provider-agnostic**. No changes needed.

#### [NO CHANGE] `services/map/polyline.ts`

Google's encoded polyline format (precision 1e-5) is the same as OSRM's. The decoder works for both.

---

### Layer 2: Mobile — Map UI Components (High effort)

This is the **biggest migration surface**. Every component currently imports `MapLibreGL` and must switch to `react-native-maps` (Google Maps provider).

#### New dependency

```bash
npx expo install react-native-maps
```

This replaces `@maplibre/maplibre-react-native`. The two libraries **cannot coexist** cleanly — both register native map views.

#### Component-by-Component Migration

| Component | MapLibre API | react-native-maps API | Effort |
|---|---|---|---|
| **MapView.tsx** | `MapLibreGL.MapView` + `MapLibreGL.Camera` | `<MapView provider={PROVIDER_GOOGLE}>` + `animateToRegion()` | **High** — Camera API is completely different. MapLibre uses `zoomLevel` + `centerCoordinate`; Google uses `region` (lat/lng/deltas) or `camera` (center/pitch/heading/zoom) |
| **RoutePolyline.tsx** | `MapLibreGL.ShapeSource` + `MapLibreGL.LineLayer` (GeoJSON) | `<Polyline coordinates={[]} />` | **Low** — simpler API. Just pass `LatLng[]` directly |
| **PickupDropoffPins.tsx** | `MapLibreGL.MarkerView` (custom React children) | `<Marker coordinate={}>` + `<Callout>` | **Medium** — Marker supports custom children similarly. Callout differs. |
| **LocationMarker.tsx** | `MapLibreGL.MarkerView` + Reanimated pulse | `<Marker>` + Reanimated pulse | **Low** — same pattern, different import |
| **DriverMarker.tsx** | `MapLibreGL.MarkerView` + Reanimated rotation | `<Marker.Animated>` or `<Marker>` + transform | **Medium** — `react-native-maps` has `Marker.Animated` that works with `Animated.Region` for smooth interpolation |
| **CarMarker.tsx** | `MapLibreGL.MarkerView` + Reanimated shared values | `<Marker>` + custom view | **Medium** — same as DriverMarker |

#### `AppMapViewRef` API differences

| Method | MapLibre | react-native-maps |
|---|---|---|
| `flyTo()` | `camera.setCamera({ centerCoordinate, animationMode: 'flyTo' })` | `mapRef.animateCamera({ center: { latitude, longitude }, zoom })` |
| `fitBounds()` | `camera.fitBounds(ne, sw, padding, duration)` | `mapRef.fitToCoordinates([ne, sw], { edgePadding, animated })` |

#### Map Style / Tiles

| MapLibre | Google Maps |
|---|---|
| Custom `map-style.json` with OSM raster tiles | Built-in Google tiles. Optional: styled maps via Google Cloud Console JSON or `customMapStyle` prop |
| `assets/map-style.json` | **DELETE** — no longer needed. Optionally create a styled map JSON from [Google Maps Styling Wizard](https://mapstyle.withgoogle.com/) |

---

### Layer 3: Mobile — Configuration (Low effort)

#### [MODIFY] `lib/config/constants.ts`

```diff
 export const ApiConfig = {
   baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
   wsUrl: process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
-  osmNominatimUrl: 'https://nominatim.openstreetmap.org',
-  osmRouterUrl: process.env.EXPO_PUBLIC_OSM_ROUTER_URL || 'http://localhost:5000',
+  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
+  // Keep OSM URLs for fallback/testing
+  osmNominatimUrl: 'https://nominatim.openstreetmap.org',
+  osmRouterUrl: process.env.EXPO_PUBLIC_OSM_ROUTER_URL || 'http://localhost:5000',
 } as const;
```

#### [MODIFY] `app.json` / `app.config.ts`

Add Google Maps API key for the native SDK:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_KEY"
        }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_IOS_KEY"
      }
    },
    "plugins": [
      ["react-native-maps", { "googleMapsApiKey": "YOUR_KEY" }]
    ]
  }
}
```

#### [DELETE] `assets/map-style.json`

No longer needed — Google Maps has built-in tile rendering.

#### Environment Variables

| Variable | Current | After Migration |
|---|---|---|
| `EXPO_PUBLIC_MAP_PROVIDER` | `osm` | `google` |
| `EXPO_PUBLIC_OSM_ROUTER_URL` | `http://localhost:5000` | Remove (or keep for fallback) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | — | **New** (required) |

---

### Layer 4: Backend — Routing Engine (Medium effort)

#### [MODIFY] `trip-service/src/trips/trips.service.ts`

The `estimateFare()` method calls OSRM directly. Replace with Google Directions API:

```diff
-const res = await fetchInternal(
-  `${OSRM_URL}/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=false`,
+const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;
+const res = await fetch(
+  `https://maps.googleapis.com/maps/api/directions/json?origin=${pickupLat},${pickupLng}&destination=${dropoffLat},${dropoffLng}&key=${GOOGLE_API_KEY}`,
```

Response mapping:
- OSRM: `data.routes[0].distance` (meters), `data.routes[0].duration` (seconds)
- Google: `data.routes[0].legs[0].distance.value` (meters), `data.routes[0].legs[0].duration.value` (seconds)

**Recommended approach**: Extract a `RoutingService` abstraction similar to the mobile `MapProvider` pattern:

```typescript
interface RoutingService {
  getRoute(origin: LatLng, dest: LatLng): Promise<{ distanceMeters: number; durationSeconds: number }>;
}
```

#### [MODIFY] `websocket-server/src/modules/realtime/consumers.ts`

`LocationUpdateConsumer` calls OSRM for real-time ETA enrichment. Same API swap as above.

#### [MODIFY] `match-service/src/modules/match/service.ts`

`getOSRMDistance()` is a static method that calls OSRM. Rename to `getRouteDistance()` and swap the API call.

#### [MODIFY] `docker-compose.yml`

The `osrm-backend` service can be **removed** — no longer self-hosting a routing engine.

```diff
-  # ── OSRM Backend (Egypt routing engine) ──
-  osrm-backend:
-    image: ghcr.io/project-osrm/osrm-backend:v6.0.0
-    container_name: ain-rider-osrm
-    ...
```

**New environment variable**: `GOOGLE_MAPS_SERVER_KEY` (server-restricted API key — different from client key)

---

### Layer 5: Shared Types (No change)

| File | Status |
|---|---|
| `shared-types/src/location.types.ts` | `distanceMeters` / `durationSeconds` fields stay the same — they're unit-based, not provider-specific ✅ |
| `shared-types/src/trip.types.ts` | No changes needed ✅ |

---

## Migration Execution Order

> [!IMPORTANT]
> The migration should be done in this exact order to avoid breaking the app at any intermediate step.

### Phase 1: Backend routing (can be done independently)

1. Create `RoutingService` abstraction in backend
2. Implement `GoogleRoutingService` behind the abstraction
3. Swap `OSRM_URL` → Google Directions in all 3 backend files
4. Remove OSRM Docker container
5. **Test**: Fare estimation, match distance, real-time ETA still work

### Phase 2: Mobile service provider

1. Implement `google.provider.ts` (Directions + Geocoding + Places)
2. Set `EXPO_PUBLIC_MAP_PROVIDER=google`
3. **Test**: Search, routing, reverse geocoding all work via Google APIs
4. Map tiles still show OSM (MapLibre) — this is fine temporarily

### Phase 3: Mobile map UI components (biggest change)

1. Install `react-native-maps`, remove `@maplibre/maplibre-react-native`
2. Rewrite `MapView.tsx` → Google Maps provider
3. Rewrite `RoutePolyline.tsx` → `<Polyline>`
4. Rewrite all marker components
5. Update `AppMapViewRef` imperative API
6. Delete `assets/map-style.json`
7. Update `app.json` with Google Maps native config
8. **Test**: Full E2E — rider flow, driver flow, real-time tracking

### Phase 4: Cleanup

1. Remove `osm.provider.ts` (or keep as fallback)
2. Remove `osmNominatimUrl` / `osmRouterUrl` from constants
3. Remove `@maplibre/maplibre-react-native` from `package.json`
4. Update documentation

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Google Maps API costs | **High** | Set billing alerts, use Distance Matrix for batch calculations, cache results aggressively in Redis |
| API key exposure in client bundle | **Medium** | Proxy through API gateway, restrict key in Google Cloud Console |
| `react-native-maps` ↔ MapLibre incompatibility during transition | **Medium** | Do Phase 3 as a single atomic PR — don't try to run both map SDKs simultaneously |
| Polyline format differences | **None** | Both use Google's encoded polyline format (1e-5 precision) ✅ |
| Coordinate system differences | **None** | Both use WGS84 (lat/lng) ✅ |
| Marker animation differences | **Low** | `react-native-maps` has `Marker.Animated` with `AnimatedRegion` — arguably better than MapLibreGL.MarkerView for smooth animation |

---

## Cost Estimation (Google Maps Platform)

| API | Free tier | Cost after free tier | Estimated usage/month |
|---|---|---|---|
| Maps SDK (mobile) | Unlimited | Free | N/A |
| Directions API | $200 credit (~40K requests) | $5 per 1K requests | ~10K (route calc + re-route) |
| Geocoding API | $200 credit (~40K requests) | $5 per 1K requests | ~5K (reverse geocode) |
| Places Autocomplete | $200 credit (~11.3K sessions) | $17 per 1K sessions | ~3K (search) |
| Distance Matrix | $200 credit (~40K elements) | $5 per 1K elements | ~5K (match service) |

> Google provides $200/month free credit. For early-stage, this should cover initial usage.

---

## Files Changed Summary

### Will change

| File | Layer | Effort |
|---|---|---|
| `services/map/google.provider.ts` | Service | Medium |
| `services/map/index.ts` | Service | Trivial |
| `components/map/MapView.tsx` | UI | **High** |
| `components/map/RoutePolyline.tsx` | UI | Low |
| `components/map/PickupDropoffPins.tsx` | UI | Medium |
| `components/map/LocationMarker.tsx` | UI | Low |
| `components/map/DriverMarker.tsx` | UI | Medium |
| `components/map/CarMarker.tsx` | UI | Medium |
| `lib/config/constants.ts` | Config | Trivial |
| `app.json` or `app.config.ts` | Config | Trivial |
| `trip-service/trips.service.ts` | Backend | Medium |
| `websocket-server/consumers.ts` | Backend | Medium |
| `match-service/service.ts` | Backend | Medium |
| `docker-compose.yml` | Infra | Low |

### Will NOT change

| File | Reason |
|---|---|
| `services/map/map.provider.ts` | Interface is provider-agnostic ✅ |
| `services/map/polyline.ts` | Format is identical ✅ |
| `stores/trip.store.ts` | Uses `LatLng` / `RouteResult` — no provider coupling ✅ |
| `stores/driver.store.ts` | Uses `LatLng` — no provider coupling ✅ |
| `hooks/useTrip.ts` | Calls `mapProvider` — provider-agnostic ✅ |
| `hooks/useLocation.ts` | Uses `expo-location` — no map dependency ✅ |
| `services/location.service.ts` | Uses `expo-location` — no map dependency ✅ |
| `services/websocket.service.ts` | No map dependency ✅ |
| All screen files (`confirm.tsx`, `search.tsx`, `trip/[id].tsx`, etc.) | They import from `components/map/*` — as long as the component API stays the same, screens don't change ✅ |
| `shared-types/*` | Units are provider-agnostic (meters, seconds) ✅ |

---

## Architectural Recommendation

> [!TIP]
> **Before starting the migration, consider adding a thin UI abstraction for map components** — similar to the existing service abstraction. Create wrapper components like `<AppMarker>`, `<AppPolyline>` that accept standard props and internally delegate to MapLibre or Google Maps.
>
> This would mean: screens never import `MapLibreGL` or `react-native-maps` directly. The migration then becomes a single-directory swap (`components/map/`) rather than touching every screen.
>
> **Current state**: Screens already only import from `components/map/*` — so this is effectively already the case. The key is to keep the component API (props) stable during the swap.
