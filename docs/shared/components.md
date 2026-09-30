# Shared/Layout/UI Components Code Review

**Workspace**: mobile, dashboard
**Domain**: components
**Date**: 2026-04-07
**Files Covered**: 15+ component files

## Summary

The components are well-organized with clear separation between map components, shared UI components, and layout components. The map components use MapLibre GL with proper animation support via Reanimated. The dashboard shared components provide consistent UI patterns. However, there are issues with missing accessibility, missing error boundaries, hardcoded styles, and missing type safety.

## Files Covered

### Mobile Components

| File | Status | Notes |
|------|--------|-------|
| `components/map/MapView.tsx` | Clean | Good ref forwarding |
| `components/map/LocationMarker.tsx` | Issues found | Missing accessibility |
| `components/map/DriverMarker.tsx` | Issues found | Missing key handling |
| `components/map/PickupDropoffPins.tsx` | Clean | Simple component |
| `components/map/RoutePolyline.tsx` | Clean | GeoJSON handling |
| `components/RejectionBanner.tsx` | Issues found | NativeWind className |

### Dashboard Components

| File | Status | Notes |
|------|--------|-------|
| `components/shared/DataTable.tsx` | Issues found | Missing row key |
| `components/shared/StatCard.tsx` | Clean | Good component |
| `components/shared/EmptyState.tsx` | Clean | Good component |
| `components/shared/ErrorState.tsx` | Not reviewed | - |
| `components/shared/PageHeader.tsx` | Not reviewed | - |
| `components/shared/Pagination.tsx` | Not reviewed | - |
| `components/shared/StatusBadge.tsx` | Not reviewed | - |
| `components/shared/TableSkeleton.tsx` | Not reviewed | - |
| `components/shared/ThemeToggle.tsx` | Not reviewed | - |
| `components/shared/ConfirmDialog.tsx` | Not reviewed | - |
| `components/shared/ProtectedRoute.tsx` | Reviewed in DASH-PG-001 |
| `components/shared/GuestRoute.tsx` | Not reviewed | - |
| `components/shared/SearchInput.tsx` | Not reviewed | - |

---

## HIGH FINDINGS

### HIGH COMP-001: DataTable Using Index as Key

- **File**: `dashboard/src/components/shared/DataTable.tsx:45-55`
- **Category**: bug
- **Impact**: Incorrect re-renders, accessibility issues

**Description**

The DataTable uses array index as the row key:
```tsx
{data.map((row, index) => (
  <TableRow
    key={index} // Index as key - problematic
    onClick={onRowClick ? () => onRowClick(row) : undefined}
  >
```

Using index as key causes issues when:
- Data is sorted or filtered
- Rows are added/removed
- Row order changes

**Recommendation**

Require a key extractor:
```tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  // ...
}

{data.map((row) => (
  <TableRow
    key={keyExtractor(row)}
    onClick={onRowClick ? () => onRowClick(row) : undefined}
  >
```

Usage:
```tsx
<DataTable
  data={complaints}
  columns={columns}
  keyExtractor={(row) => row.id}
/>
```

---

### HIGH COMP-002: MapView Missing Error Boundary

- **File**: `mobile/components/map/MapView.tsx`
- **Category**: bug
- **Impact**: App crash on map load failure

**Description**

The MapView component has no error handling. If the map fails to load (missing style, network error, native crash), the entire app may crash.

```tsx
export const AppMapView = forwardRef<AppMapViewRef, MapViewProps>(function AppMapView(
  { center = BAGHDAD, zoom = 13, onPress, onRegionChange, children, style },
  ref,
) {
  // No error boundary
  return (
    <View style={[{ flex: 1 }, style]}>
      <MapLibreGL.MapView
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        // ...
      >
```

**Recommendation**

Wrap in error boundary:
```tsx
import { ErrorBoundary } from 'react-error-boundary';

export const AppMapView = forwardRef<AppMapViewRef, MapViewProps>(function AppMapView(
  { center = BAGHDAD, zoom = 13, onPress, onRegionChange, children, style },
  ref,
) {
  return (
    <ErrorBoundary
      fallback={<View style={styles.error}><Text>Map unavailable</Text></View>}
    >
      <View style={[{ flex: 1 }, style]}>
        <MapLibreGL.MapView ... />
      </View>
    </ErrorBoundary>
  );
});
```

---

## MEDIUM FINDINGS

### MEDIUM COMP-003: LocationMarker Missing Accessibility Labels

- **File**: `mobile/components/map/LocationMarker.tsx:30-50`
- **Category**: accessibility
- **Impact**: Screen readers can't identify markers

**Description**

The marker has no accessibility label:
```tsx
<MapLibreGL.MarkerView coordinate={[coordinate.longitude, coordinate.latitude]}>
  <View style={styles.container}>
    <Animated.View style={[styles.pulse, pulseStyle]} />
    <Animated.View style={[styles.markerContainer, ...]}>
      <View style={styles.iconCircle}>
        <Ionicons 
          name={type === 'driver' ? "car" : "person"} 
          // No accessibilityLabel
        />
      </View>
    </Animated.View>
  </View>
</MapLibreGL.MarkerView>
```

**Recommendation**

Add accessibility:
```tsx
<View 
  style={styles.container}
  accessible={true}
  accessibilityLabel={type === 'driver' ? 'Driver location' : 'Your location'}
  accessibilityRole="image"
>
```

---

### MEDIUM COMP-004: DriverMarker Missing Unique ID Handling

- **File**: `mobile/components/map/DriverMarker.tsx:15-35`
- **Category**: bug
- **Impact**: Marker animation issues

**Description**

The `id` prop is passed but never used. When multiple drivers are rendered, React may not properly track marker identity:

```tsx
interface DriverMarkerProps {
  id: string; // Never used
  coordinate: LatLng;
  heading?: number;
}

export function DriverMarker({ id, coordinate, heading = 0 }: DriverMarkerProps) {
  // id is destructured but not used
}
```

**Recommendation**

The parent should use `id` as key:
```tsx
// In parent component
{drivers.map((driver) => (
  <DriverMarker
    key={driver.id} // Use id as key
    id={driver.id}
    coordinate={driver.coordinate}
    heading={driver.heading}
  />
))}
```

Or document that `id` is for key purposes only.

---

### MEDIUM COMP-005: RejectionBanner Using NativeWind with Wrong Syntax

- **File**: `mobile/components/RejectionBanner.tsx:15-25`
- **Category**: bug
- **Impact**: Styles may not apply correctly

**Description**

The component uses `className` prop which requires NativeWind, but the syntax has issues:
```tsx
<View className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex-row items-center gap-3 mb-6">
```

The opacity modifiers (`/10`, `/20`) may not work correctly with all NativeWind versions.

**Recommendation**

Use StyleSheet for complex styles:
```tsx
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
});
```

---

### MEDIUM COMP-006: MapView Hardcoded Baghdad Fallback

- **File**: `mobile/components/map/MapView.tsx:7`
- **Category**: bug
- **Impact**: Wrong location shown

**Description**

```tsx
const BAGHDAD = { latitude: 30.147719, longitude: 31.394327 };
```

This is duplicated from `location.service.ts`. If the app is used in other cities, this fallback is wrong.

**Recommendation**

Import from a shared config:
```tsx
// lib/config.ts
export const DEFAULT_LOCATION = { 
  latitude: 30.147719, 
  longitude: 31.394327,
  city: 'Baghdad'
};

// In MapView.tsx
import { DEFAULT_LOCATION } from '../../lib/config';
```

---

### MEDIUM COMP-007: DataTable Pagination Not Connected to Data

- **File**: `dashboard/src/components/shared/DataTable.tsx:55-80`
- **Category**: bug
- **Impact**: Pagination doesn't actually paginate data

**Description**

The pagination UI is rendered but the data is not sliced:
```tsx
{data.map((row, index) => (
  // All data is rendered, not just current page
))}

{pagination && pagination.totalPages > 1 && (
  // Pagination UI shown but doesn't affect displayed data
)}
```

**Recommendation**

Either slice data or document that pagination is handled externally:
```tsx
// Option 1: Slice data internally
const paginatedData = pagination 
  ? data.slice((pagination.page - 1) * pageSize, pagination.page * pageSize)
  : data;

// Option 2: Document external handling
interface DataTableProps<T> {
  /**
   * Data to display. If pagination is enabled, this should be pre-sliced
   * to the current page's data.
   */
  data: T[];
}
```

---

### MEDIUM COMP-008: RoutePolyline Missing Validation

- **File**: `mobile/components/map/RoutePolyline.tsx:15-25`
- **Category**: bug
- **Impact**: Invalid coordinates cause issues

**Description**

Only checks for minimum 2 coordinates, but doesn't validate each coordinate:
```tsx
if (coordinates.length < 2) return null;

const geoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
  // No validation of latitude/longitude ranges
  geometry: {
    type: 'LineString',
    coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
  },
};
```

**Recommendation**

Validate coordinates:
```tsx
const isValidCoordinate = (c: LatLng): boolean => {
  return (
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    c.latitude >= -90 && c.latitude <= 90 &&
    c.longitude >= -180 && c.longitude <= 180 &&
    !isNaN(c.latitude) && !isNaN(c.longitude)
  );
};

const validCoordinates = coordinates.filter(isValidCoordinate);
if (validCoordinates.length < 2) return null;
```

---

## LOW FINDINGS

### LOW COMP-009: MapView Camera Ref Type is `any`

- **File**: `mobile/components/map/MapView.tsx:25`
- **Category**: type-safety
- **Impact**: Type errors at runtime

**Description**

```tsx
const cameraRef = useRef<any>(null);
```

**Recommendation**

Use proper type:
```tsx
import type { Camera } from '@maplibre/maplibre-react-native';
const cameraRef = useRef<Camera>(null);
```

---

### LOW COMP-010: LocationMarker Animation Never Stops

- **File**: `mobile/components/map/LocationMarker.tsx:20-25`
- **Category**: performance
- **Impact**: Unnecessary animation cycles

**Description**

The pulse animation runs forever:
```tsx
useEffect(() => {
  scale.value = withRepeat(withTiming(1.2, { duration: 2000 }), -1, true);
}, []);
```

This is intentional for the "live location" effect, but could be optimized to pause when app is in background.

**Recommendation**

Add app state listener:
```tsx
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      scale.value = withRepeat(withTiming(1.2, { duration: 2000 }), -1, true);
    } else {
      cancelAnimation(scale);
    }
  });
  return () => subscription.remove();
}, []);
```

---

### LOW COMP-011: StatCard Missing Loading State

- **File**: `dashboard/src/components/shared/StatCard.tsx`
- **Category**: ux
- **Impact**: No loading indication

**Description**

When data is loading, the stat card shows nothing or stale data.

**Recommendation**

Add loading prop:
```tsx
interface StatCardProps {
  // ...
  isLoading?: boolean;
}

export function StatCard({ isLoading, ... }: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16 mt-2" />
      </Card>
    );
  }
  // ...
}
```

---

### LOW COMP-012: PickupDropoffPins Hardcoded English Labels

- **File**: `mobile/components/map/PickupDropoffPins.tsx:20-35`
- **Category**: i18n
- **Impact**: No RTL/language support

**Description**

```tsx
<Text style={styles.pinLabel} numberOfLines={1}>
  Pickup
</Text>
// ...
<Text style={styles.pinLabel} numberOfLines={1}>
  Dropoff
</Text>
```

**Recommendation**

Use i18n:
```tsx
import { t } from '../../lib/i18n';

<Text style={styles.pinLabel} numberOfLines={1}>
  {t('pickup')}
</Text>
```

---

### LOW COMP-013: EmptyState Missing Accessibility

- **File**: `dashboard/src/components/shared/EmptyState.tsx`
- **Category**: accessibility
- **Impact**: Screen readers miss context

**Description**

The empty state has no accessibility role:
```tsx
<div className="flex flex-col items-center justify-center py-16 px-4">
  <div ...>
    <Icon size={28} ... />
  </div>
  <h3 ...>{title}</h3>
  <p ...>{description}</p>
</div>
```

**Recommendation**

Add accessibility:
```tsx
<div 
  role="status"
  aria-live="polite"
  className="flex flex-col items-center justify-center py-16 px-4"
>
```

---

### LOW COMP-014: DataTable Missing Empty State

- **File**: `dashboard/src/components/shared/DataTable.tsx`
- **Category**: ux
- **Impact**: Empty table shows nothing

**Description**

When data is empty, the table shows just headers:
```tsx
{data.map((row, index) => (
  // If data is empty, nothing renders
))}
```

**Recommendation**

Add empty state:
```tsx
{data.length === 0 ? (
  <div className="py-8 text-center text-muted-foreground">
    No data available
  </div>
) : (
  data.map((row, index) => ( ... ))
)}
```

---

## Cross-References

| Finding | Related |
|---------|---------|
| COMP-001 | DASH-PG-004 (Pagination) |
| COMP-002 | MOB-S-003 (Error boundaries) |
| COMP-003 | MOB-S-015 (Accessibility) |
| COMP-006 | MOB-HK-008 (Location fallback) |
| COMP-007 | DASH-PG-004 (Pagination) |
| COMP-008 | MOB-API-001 (Validation) |
| COMP-012 | MOB-S-014 (RTL support) |