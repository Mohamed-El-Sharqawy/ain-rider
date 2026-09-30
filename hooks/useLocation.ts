import { useEffect, useRef } from 'react';
import { locationService } from '../services/location.service';
import { useLocationStore } from '../stores/location.store';
import { LatLng } from '../services/map/map.provider';

export function useLocation() {
  const { currentLocation, isTracking, permissionGranted, setLocation, setTracking, setPermission } =
    useLocationStore();
  const initialized = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    isMounted.current = true;

    (async () => {
      const granted = await locationService.requestPermissions();
      if (!isMounted.current) return;
      setPermission(granted);
      if (granted) {
        try {
          const loc = await locationService.getCurrentLocation();
          if (!isMounted.current) return;
          setLocation(loc, loc.heading, loc.speed);
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      isMounted.current = false;
    };
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
