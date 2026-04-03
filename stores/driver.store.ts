import { create } from 'zustand';
import { LatLng, RouteResult } from '../services/map/map.provider';

interface CurrentDriverTrip {
  tripId: string;
  riderId: string;
  pickupLocation: LatLng;
  dropoffLocation: LatLng;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
}

interface DriverState {
  isOnline: boolean;
  currentTrip: CurrentDriverTrip | null;
  riderLocation: LatLng | null;
  tripRoute: RouteResult | null;

  setOnline: (isOnline: boolean) => void;
  setCurrentTrip: (trip: CurrentDriverTrip | null) => void;
  setRiderLocation: (location: LatLng) => void;
  setTripRoute: (route: RouteResult) => void;
  reset: () => void;
}

const initialState = {
  isOnline: false,
  currentTrip: null,
  riderLocation: null,
  tripRoute: null,
};

export const useDriverStore = create<DriverState>((set) => ({
  ...initialState,

  setOnline: (isOnline) => set({ isOnline }),
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  setRiderLocation: (location) => set({ riderLocation: location }),
  setTripRoute: (route) => set({ tripRoute: route }),

  reset: () => set(initialState),
}));
