import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng, RouteResult } from '../services/map/map.provider';

export type TripPhase =
  | 'idle'
  | 'searching_destination'
  | 'confirming'
  | 'requesting'
  | 'matching'
  | 'matched'
  | 'driver_arriving'
  | 'in_progress'
  | 'completed'
  | 'rating';

const VALID_PHASE_TRANSITIONS: Record<TripPhase, Set<TripPhase>> = {
  idle: new Set(['searching_destination', 'requesting']),
  searching_destination: new Set(['idle', 'confirming']),
  confirming: new Set(['idle', 'searching_destination', 'requesting']),
  requesting: new Set(['idle', 'matching']),
  matching: new Set(['idle', 'matched']),
  matched: new Set(['driver_arriving', 'in_progress', 'idle']),
  driver_arriving: new Set(['in_progress', 'idle']),
  in_progress: new Set(['completed']),
  completed: new Set(['rating', 'idle']),
  rating: new Set(['idle']),
};

interface FareEstimate {
  estimatedFare: number;
  distance: number;
  duration: number;
  currency: string;
}

interface ActiveTrip {
  tripId: string;
  status: string;
  pickupLocation: LatLng;
  dropoffLocation: LatLng;
  estimatedFare: number;
}

interface DriverInfo {
  driverId: string;
  name: string;
  phone: string;
  rating: number;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  estimatedArrival: number;
  location: LatLng | null;
  distance?: number;
  duration?: number;
}

interface TripState {
  phase: TripPhase;
  selectedPickup: { location: LatLng; address: string } | null;
  selectedDropoff: { location: LatLng; address: string } | null;
  route: RouteResult | null;
  fareEstimate: FareEstimate | null;
  activeTrip: ActiveTrip | null;
  driver: DriverInfo | null;

  setPhase: (phase: TripPhase) => void;
  setPickup: (pickup: { location: LatLng; address: string }) => void;
  setDropoff: (dropoff: { location: LatLng; address: string }) => void;
  setRoute: (route: RouteResult) => void;
  setFareEstimate: (fare: FareEstimate) => void;
  setActiveTrip: (trip: ActiveTrip) => void;
  setDriver: (driver: DriverInfo) => void;
  updateDriverLocation: (location: LatLng, distance?: number, duration?: number) => void;
  reset: () => void;
}

const initialState = {
  phase: 'idle' as TripPhase,
  selectedPickup: null,
  selectedDropoff: null,
  route: null,
  fareEstimate: null,
  activeTrip: null,
  driver: null,
};

export const useTripStore = create<TripState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setPhase: (phase) =>
          set((state) => {
            if (state.phase === phase) return state;

            const allowed = VALID_PHASE_TRANSITIONS[state.phase];
            if (__DEV__ && allowed && !allowed.has(phase)) {
              console.warn(
                `[TripStore] Invalid phase transition: ${state.phase} → ${phase}`
              );
            }
            return { phase };
          }),
        setPickup: (pickup) => set({ selectedPickup: pickup }),
        setDropoff: (dropoff) => set({ selectedDropoff: dropoff }),
        setRoute: (route) => set({ route }),
        setFareEstimate: (fare) => set({ fareEstimate: fare }),
        setActiveTrip: (trip) => set({ activeTrip: trip }),
        setDriver: (driver) => set({ driver }),

        updateDriverLocation: (location, distance, duration) =>
          set((state) => ({
            driver: state.driver ? { ...state.driver, location, distance, duration } : null,
          })),

        reset: () => set(initialState),
      }),
      {
        name: 'trip-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          activeTrip: state.activeTrip,
          phase: state.phase,
          driver: state.driver,
        }),
      }
    ),
    { name: 'trip-store' }
  )
);

export const useTripPhase = () => useTripStore((s) => s.phase);
export const useActiveTrip = () => useTripStore((s) => s.activeTrip);
export const useTripDriver = () => useTripStore((s) => s.driver);
export const useTripRoute = () => useTripStore(useShallow((s) => s.route));
export const useTripLocations = () =>
  useTripStore(useShallow((s) => ({ pickup: s.selectedPickup, dropoff: s.selectedDropoff })));
