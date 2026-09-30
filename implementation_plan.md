# Fix: Rider Route Display, Smooth Driver Tracking, Navigate Button, and Background Trip Loss

Three bugs and one UX enhancement affecting the trip lifecycle after a driver accepts a ride.

## Bug Analysis

### Bug 1: Rider sees pickup→dropoff route instead of driver→pickup route
**Root cause**: The rider's [trip/[id].tsx](file:///d:/Work/ain-rider/mobile/app/(rider)/trip/[id].tsx) displays the `route` from the **trip store**, which was set back in `confirm.tsx` during fare estimation — that route is always pickup→dropoff. The screen never recalculates a route between the driver's live location and the pickup point.

The map *does* fit bounds correctly (line 152 uses `driver.location → pickupLocation` during `matched` phase), but the **polyline drawn** is the stale confirm-time pickup→dropoff route.

**Fix**: Add a local `driverRoute` state in the rider trip screen that recalculates whenever the driver's location updates. Show this route during `matched` phase, and switch to using the `route` from the store (or fetch a fresh one) during `in_progress` phase.

### Bug 2: Driver NAVIGATE button has no `onPress` handler
**Root cause**: The `<TouchableOpacity>` on [line 155-160](file:///d:/Work/ain-rider/mobile/app/(driver)/trip/[id].tsx#L155-L160) has no `onPress` prop — it's purely visual.

**Fix**: Add a handler that opens the device's native maps app (Google Maps / Apple Maps) with directions to the target location using `Linking.openURL` with a platform-appropriate URL scheme.

### Bug 3: Driver app loses trip state after 2-3 seconds in background
**Root cause (two-pronged)**:
1. **Store persistence gap**: `driver.store.ts` [line 65-67](file:///d:/Work/ain-rider/mobile/stores/driver.store.ts#L65-L67) only `partialize`s `isOnline` — `currentTrip` is **not persisted to AsyncStorage**. If the React tree remounts, the trip is gone.
2. **WS cleanup on unmount**: The driver `home.tsx` screen has a cleanup effect [line 142-152](file:///d:/Work/ain-rider/mobile/app/(driver)/(tabs)/home.tsx#L142-L152) that disconnects the WebSocket and stops tracking when the component unmounts. While the Stack layout *should* keep home mounted under the trip screen, on some RN/Expo versions, backgrounding can trigger unmounts for optimization. When the WS disconnects, the driver loses all real-time events and appears "offline."

> [!IMPORTANT]
> The `currentTrip` must be persisted so it survives app backgrounding and process death. Additionally, the driver trip screen should recover by re-fetching the trip from the API on mount, similar to how the rider trip screen does it.

---

## Proposed Changes

### [Mobile] Rider Trip Screen — Dynamic Driver Route

#### [MODIFY] [trip/[id].tsx](file:///d:/Work/ain-rider/mobile/app/(rider)/trip/[id].tsx)

1. **Add `mapProvider` import** and a local `driverRoute` state (`LatLng[]`).
2. **Add a route-fetching effect** that triggers whenever `driver.location` changes (debounced to avoid hammering OSRM). During `matched` phase, fetches route from `driver.location → pickupLocation`. During `in_progress` phase, fetches route from `driver.location → dropoffLocation`.
3. **Replace the `<RoutePolyline>` source**: Use `driverRoute` instead of `route.coordinates` from the store. The store's route (pickup→dropoff) is no longer relevant on this screen.

---

### [Mobile] Smooth Driver Marker Animation (Uber-style)

> [!IMPORTANT]
> **UX Requirement**: The driver's car marker on the rider's map must move fluidly — as if updating every frame — not teleport between discrete location updates. This is the "Uber-style" smooth tracking experience.

**Current behavior**: `DriverMarker` receives a new `coordinate` prop every ~3 seconds (from WebSocket). `MapLibreGL.MarkerView` instantly repositions to the new coordinate — the car "jumps".

**Target behavior**:
- The car marker **glides** smoothly between position updates over ~1s using eased interpolation
- The car **rotates** smoothly to face its heading (already partially implemented via reanimated, but needs coordinate-aware bearing calculation)
- The movement feels continuous even when updates arrive at 3-second intervals
- No visible stutter or rubber-banding

#### UX Specifications

| Property | Requirement |
|---|---|
| **Position interpolation** | Animate lat/lng from previous → new over 1000ms with `easeInOut` curve |
| **Heading/rotation** | Smooth rotation over 800ms; auto-calculate bearing from prev→new position if `heading` is not provided |
| **Frame rate** | Use `requestAnimationFrame` or Reanimated's UI thread to update at 60fps |
| **Overshoot protection** | If a new update arrives mid-animation, cancel the current animation and start the new one from the current interpolated position (no snap-back) |
| **Stale update handling** | If no update arrives within 5s, stop interpolating (don't extrapolate beyond the last known position) |
| **Route polyline sync** | Route polyline should update at most every 10 seconds (debounced), not on every frame |

#### Implementation

##### [NEW] `useAnimatedCoordinate` hook

A reusable hook that takes a `LatLng` target and returns interpolated `latitude`/`longitude` shared values that animate smoothly to the target.

```
const { animatedCoord, animatedHeading } = useAnimatedCoordinate(driver.location, driver.heading);
```

Internally:
- Stores previous coordinate in a ref
- On new target: uses `withTiming` (Reanimated) to animate both lat and lng shared values from current → target over 1000ms
- Computes bearing from prev → new position and animates the heading shared value
- Returns shared values that update on the UI thread at 60fps

##### [MODIFY] [DriverMarker.tsx](file:///d:/Work/ain-rider/mobile/components/map/DriverMarker.tsx)

Refactor to accept **animated shared values** instead of static coordinate props. Use a Reanimated `useAnimatedReaction` to feed interpolated `[lng, lat]` into the `MapLibreGL.MarkerView` coordinate prop on every frame.

**Key constraint**: `MapLibreGL.MarkerView`'s `coordinate` prop is a plain `[number, number]`, not an animated value. Two approaches:
1. **State-driven re-render** (simpler): Use `useAnimatedReaction` to write interpolated values back to React state at ~16ms intervals. The MarkerView re-renders but the position change per frame is tiny, so it looks smooth.
2. **Reanimated `runOnJS` callback** (lower overhead): Push interpolated coords from the UI thread to JS thread at capped intervals (every 50ms = 20fps, which still looks smooth for map markers).

Approach 1 is recommended for simplicity; approach 2 if performance is a concern.

---

### [Mobile] Driver Navigate Button

#### [MODIFY] [trip/[id].tsx](file:///d:/Work/ain-rider/mobile/app/(driver)/trip/[id].tsx)

1. **Import `Linking` and `Platform`** from react-native.
2. **Add `handleNavigate` function** that:
   - Determines target: `pickupLocation` during `arriving`, `dropoffLocation` during `in_progress`
   - Constructs a platform-specific deep link:
     - iOS: `maps://app?daddr={lat},{lng}`
     - Android: `google.navigation:q={lat},{lng}`
   - Falls back to `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` (web)
3. **Wire `onPress={handleNavigate}`** on the NAVIGATE button.
4. **Add a NAVIGATE button to the `in_progress` phase** too (currently the driver only sees "COMPLETE TRIP" with no navigation option).

---

### [Mobile] Driver Store Persistence & Trip Recovery

#### [MODIFY] [driver.store.ts](file:///d:/Work/ain-rider/mobile/stores/driver.store.ts)

- Add `currentTrip` to the `partialize` function so it persists to AsyncStorage.

#### [MODIFY] [trip/[id].tsx](file:///d:/Work/ain-rider/mobile/app/(driver)/trip/[id].tsx) *(driver)*

- Add a trip-recovery effect on mount (similar to rider's `syncTripState`): if `currentTrip` is null but `tripId` is present in the URL, fetch the trip from the API and reconstruct `currentTrip`.

#### [MODIFY] [home.tsx](file:///d:/Work/ain-rider/mobile/app/(driver)/(tabs)/home.tsx)

- **Guard the unmount cleanup** (line 142-152): only disconnect WS and stop tracking if the driver is **not** on an active trip. Check `driverStore.currentTrip` before tearing down.
- **Guard the AppState foreground handler**: When coming back from background, if there's a `currentTrip`, ensure the WS is reconnected and subscriptions are restored.

---

## Verification Plan

### Manual Verification
1. **Rider route**: Request a trip → after driver accepts, verify the rider map shows a route from the driver's position to the pickup (not to dropoff). After driver starts trip, route should switch to driver→dropoff.
2. **Navigate button**: As driver in `arriving` phase, tap NAVIGATE → native maps should open with directions to pickup. In `in_progress`, NAVIGATE should target dropoff.
3. **Background resilience**: As driver on the trip screen, background the app for 5 seconds → foreground → verify the trip screen is still active, online status is preserved, and real-time location updates resume.
