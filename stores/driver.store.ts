import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng, RouteResult } from '../services/map/map.provider';
import { DriverApi } from '../lib/api/driver';

interface CurrentDriverTrip {
  tripId: string;
  riderId: string;
  pickupLocation: LatLng;
  dropoffLocation: LatLng;
  pickupAddress: string;
  dropoffAddress: string;
  status: string;
  estimatedDuration: number | null;
  estimatedFare: number | null;
  riderName: string | null;
  riderPhone: string | null;
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
  syncOnlineStatus: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  isOnline: false,
  currentTrip: null,
  riderLocation: null,
  tripRoute: null,
};

export const useDriverStore = create<DriverState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setOnline: (isOnline) => set({ isOnline }),
        setCurrentTrip: (trip) => set({ currentTrip: trip }),
        setRiderLocation: (location) => set({ riderLocation: location }),
        setTripRoute: (route) => set({ tripRoute: route }),

        syncOnlineStatus: async () => {
          const { isOnline } = get();
          try {
            await DriverApi.updateStatus(isOnline);
          } catch { }
        },

        reset: () => set(initialState),
      }),
      {
        name: 'driver-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          isOnline: state.isOnline,
          currentTrip: state.currentTrip,
        }),
      }
    ),
    { name: 'driver-store' }
  )
);
