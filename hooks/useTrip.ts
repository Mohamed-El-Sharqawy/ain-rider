import { useCallback } from 'react';
import { useTripStore } from '../stores/trip.store';
import { TripApi } from '../lib/api/trip.api';
import { wsService } from '../services/websocket.service';
import { mapProvider } from '../services/map';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useTrip() {
  const store = useTripStore();

  const requestTrip = useCallback(
    async (onMatched?: (tripId: string) => void) => {
      const { selectedPickup, selectedDropoff, fareEstimate } = useTripStore.getState();
      if (!selectedPickup || !selectedDropoff) return;

      store.setPhase('requesting');

      try {
        const trip = await TripApi.createTrip({
          pickupLatitude: selectedPickup.location.latitude,
          pickupLongitude: selectedPickup.location.longitude,
          pickupAddress: selectedPickup.address,
          dropoffLatitude: selectedDropoff.location.latitude,
          dropoffLongitude: selectedDropoff.location.longitude,
          dropoffAddress: selectedDropoff.address,
          estimatedFare: fareEstimate?.estimatedFare ?? 0,
          paymentMethod: 'CASH',
        });

        store.setActiveTrip({
          tripId: trip.id,
          status: trip.status,
          pickupLocation: selectedPickup.location,
          dropoffLocation: selectedDropoff.location,
          estimatedFare: trip.estimatedFare,
        });

        store.setPhase('matching');

        wsService.connect(WS_URL);
        wsService.subscribe('trip', `${trip.id}:rider`);

        onMatched?.(trip.id);
      } catch (error) {
        store.setPhase('idle');
        throw error;
      }
    },
    [store],
  );

  const cancelTrip = useCallback(
    async (tripId: string, reason: string = 'Rider cancelled') => {
      await TripApi.cancelTrip(tripId, reason);
      wsService.unsubscribe('trip', `${tripId}:rider`);
      store.reset();
    },
    [store],
  );

  const rateTrip = useCallback(
    async (tripId: string, rating: number) => {
      await TripApi.rateTrip(tripId, rating, 'rider');
      store.reset();
    },
    [store],
  );

  const fetchRoute = useCallback(
    async () => {
      const { selectedPickup, selectedDropoff } = useTripStore.getState();
      if (!selectedPickup || !selectedDropoff) return;

      const route = await mapProvider.getRoute(
        selectedPickup.location,
        selectedDropoff.location,
      );
      store.setRoute(route);
    },
    [store],
  );

  return {
    ...store,
    requestTrip,
    cancelTrip,
    rateTrip,
    fetchRoute,
  };
}
