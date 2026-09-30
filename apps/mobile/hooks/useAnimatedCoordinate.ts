import { useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the bearing (heading in degrees) between two coordinates.
 * Returns 0-360 where 0=North, 90=East, etc.
 */
function calculateBearing(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Normalizes the rotation delta to take the shortest path around the circle.
 * Avoids the marker spinning 350° clockwise when it should spin 10° counter-clockwise.
 */
function shortestRotation(from: number, to: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  return from + delta;
}

const ANIMATION_DURATION = 1000;
const HEADING_DURATION = 800;
const FRAME_INTERVAL_MS = 50; // 20fps for MarkerView coordinate updates — smooth enough for map

const EASING = Easing.bezier(0.4, 0, 0.2, 1);

interface AnimatedCoordinateResult {
  /** Current interpolated coordinate (updated at ~20fps). Use this for MarkerView. */
  coord: LatLng;
  /** Current interpolated heading in degrees. */
  heading: number;
  /** Reanimated shared values (for direct use in useAnimatedStyle if needed). */
  sharedLat: { value: number };
  sharedLng: { value: number };
  sharedHeading: { value: number };
}

/**
 * Uber-style smooth coordinate interpolation hook.
 *
 * Takes a target LatLng (updated every ~3s from WebSocket) and returns
 * an interpolated coordinate that animates smoothly between updates
 * at 20fps via Reanimated's UI thread.
 *
 * Features:
 * - Position eased over 1000ms with bezier curve
 * - Heading smoothed over 800ms, auto-calculated from movement if not provided
 * - Overshoot protection: new updates start from current interpolated position
 * - Shortest-path rotation (no 350° spins)
 *
 * @param target The latest coordinate from the server
 * @param targetHeading Optional explicit heading. If omitted, heading is calculated from movement.
 */
export function useAnimatedCoordinate(
  target: LatLng | null | undefined,
  targetHeading?: number,
): AnimatedCoordinateResult {
  const sharedLat = useSharedValue(target?.latitude ?? 0);
  const sharedLng = useSharedValue(target?.longitude ?? 0);
  const sharedHeading = useSharedValue(targetHeading ?? 0);

  // React state for MarkerView coordinate prop (updated at capped rate from UI thread)
  const coordRef = useRef<LatLng>({
    latitude: target?.latitude ?? 0,
    longitude: target?.longitude ?? 0,
  });
  const headingRef = useRef(targetHeading ?? 0);

  // Track previous target to calculate bearing
  const prevTargetRef = useRef<LatLng | null>(null);

  // Force re-render at capped rate
  const setterRef = useRef<((coord: LatLng, heading: number) => void) | null>(null);
  const stateRef = useRef({ coord: coordRef.current, heading: headingRef.current });

  // Use a simple interval-based approach to bridge UI thread → JS thread
  // This avoids the complexity of useAnimatedReaction + runOnJS for coordinate syncing
  useEffect(() => {
    const interval = setInterval(() => {
      const lat = sharedLat.value;
      const lng = sharedLng.value;
      const h = sharedHeading.value;

      // Only update if values actually changed (avoid unnecessary re-renders)
      const prev = coordRef.current;
      if (
        Math.abs(prev.latitude - lat) > 0.0000001 ||
        Math.abs(prev.longitude - lng) > 0.0000001 ||
        Math.abs(headingRef.current - h) > 0.1
      ) {
        coordRef.current = { latitude: lat, longitude: lng };
        headingRef.current = h;
        stateRef.current = { coord: coordRef.current, heading: h };
        // Trigger re-render via the setter if connected
        setterRef.current?.(coordRef.current, h);
      }
    }, FRAME_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Re-render bridge: useState that's only updated by the interval
  const [renderState] = useRenderBridge(stateRef, setterRef);

  // Animate to new target when it changes
  useEffect(() => {
    if (!target) return;

    const prev = prevTargetRef.current;

    // Animate position
    sharedLat.value = withTiming(target.latitude, {
      duration: ANIMATION_DURATION,
      easing: EASING,
    });
    sharedLng.value = withTiming(target.longitude, {
      duration: ANIMATION_DURATION,
      easing: EASING,
    });

    // Calculate or use provided heading
    let newHeading = targetHeading ?? 0;
    if (prev && !targetHeading) {
      const dist =
        Math.abs(target.latitude - prev.latitude) +
        Math.abs(target.longitude - prev.longitude);
      // Only update heading if the movement is significant (avoids jitter from GPS noise)
      if (dist > 0.00005) {
        newHeading = calculateBearing(prev, target);
      } else {
        newHeading = sharedHeading.value; // Keep current heading
      }
    }

    // Shortest-path rotation
    const resolved = shortestRotation(sharedHeading.value, newHeading);
    sharedHeading.value = withTiming(resolved, {
      duration: HEADING_DURATION,
      easing: EASING,
    });

    prevTargetRef.current = target;
  }, [target?.latitude, target?.longitude, targetHeading]);

  return {
    coord: renderState.coord,
    heading: renderState.heading,
    sharedLat,
    sharedLng,
    sharedHeading,
  };
}

/**
 * Internal hook: bridges the interval-based updates to React state
 * without causing render loops in the main hook.
 */
function useRenderBridge(
  stateRef: React.MutableRefObject<{ coord: LatLng; heading: number }>,
  setterRef: React.MutableRefObject<((coord: LatLng, heading: number) => void) | null>,
) {
  const [state, setState] = useState(stateRef.current);

  useEffect(() => {
    setterRef.current = (coord: LatLng, heading: number) => {
      setState({ coord, heading });
    };
    return () => {
      setterRef.current = null;
    };
  }, []);

  return [state, setState] as const;
}
