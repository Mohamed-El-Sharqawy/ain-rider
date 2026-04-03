import { useEffect, useRef } from 'react';
import { locationService } from '../services/location.service';
import { useLocationStore } from '../stores/location.store';
import { LatLng } from '../services/map/map.provider';

export function useLocation() {
  const { currentLocation, isTracking, permissionGranted, setLocation, setTracking, setPermission } =
    useLocationStore();
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    (async () => {
      const granted = await locationService.requestPermissions();
      setPermission(granted);
      if (granted) {
        try {
          const loc = await locationService.getCurrentLocation();
          setLocation(loc, loc.heading, loc.speed);
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  const startTracking = async (onUpdate?: (loc: LatLng & { heading?: number; speed?: number }) => void) => {
    await locationService.startTracking((loc) => {
      setLocation(loc, loc.heading, loc.speed);
      onUpdate?.(loc);
    });
    setTracking(true);
  };

  const stopTracking = async () => {
    await locationService.stopTracking();
    setTracking(false);
  };

  return {
    currentLocation,
    isTracking,
    permissionGranted,
    startTracking,
    stopTracking,
  };
}
