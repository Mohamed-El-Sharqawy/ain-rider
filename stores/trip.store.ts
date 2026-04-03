import { create } from 'zustand';
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
  updateDriverLocation: (location: LatLng) => void;
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

export const useTripStore = create<TripState>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setPickup: (pickup) => set({ selectedPickup: pickup }),
  setDropoff: (dropoff) => set({ selectedDropoff: dropoff }),
  setRoute: (route) => set({ route }),
  setFareEstimate: (fare) => set({ fareEstimate: fare }),
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  setDriver: (driver) => set({ driver }),

  updateDriverLocation: (location) =>
    set((state) => ({
      driver: state.driver ? { ...state.driver, location } : null,
    })),

  reset: () => set(initialState),
}));
