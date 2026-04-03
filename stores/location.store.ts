import { create } from 'zustand';
import { LatLng } from '../services/map/map.provider';

interface LocationState {
  currentLocation: LatLng | null;
  heading: number | null;
  speed: number | null;
  isTracking: boolean;
  permissionGranted: boolean;

  setLocation: (loc: LatLng, heading?: number, speed?: number) => void;
  setTracking: (isTracking: boolean) => void;
  setPermission: (granted: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  heading: null,
  speed: null,
  isTracking: false,
  permissionGranted: false,

  setLocation: (loc, heading, speed) =>
    set({ currentLocation: loc, heading: heading ?? null, speed: speed ?? null }),

  setTracking: (isTracking) => set({ isTracking }),

  setPermission: (granted) => set({ permissionGranted: granted }),
}));
