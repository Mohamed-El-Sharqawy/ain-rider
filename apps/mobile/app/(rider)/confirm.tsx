import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useTripStore } from '../../stores/trip.store';
import { useTrip } from '../../hooks/useTrip';
import { TripApi } from '../../lib/api/trip.api';
import { useLocation } from '../../hooks/useLocation';
import { AppMapView } from '../../components/map/MapView';
import { LocationMarker } from '../../components/map/LocationMarker';
import { RoutePolyline } from '../../components/map/RoutePolyline';
import { PickupDropoffPins } from '../../components/map/PickupDropoffPins';
import { mapProvider } from '../../services/map';
import { useNearbyDrivers } from '../../hooks/useNearbyDrivers';
import { CarMarker } from '../../components/map/CarMarker';

export default function ConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tripStore = useTripStore();
  const { requestTrip } = useTrip();
  const { currentLocation } = useLocation();
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const pickup = tripStore.selectedPickup;
  const dropoff = tripStore.selectedDropoff;

  const { drivers: nearbyDrivers } = useNearbyDrivers(
    pickup?.location.latitude,
    pickup?.location.longitude,
    !requesting
  );

  // Redirect back if pickup or dropoff is missing
  useEffect(() => {
    if (!pickup || !dropoff) {
      router.back();
    }
  }, []);

  // Fetch route + fare estimate
  useEffect(() => {
    if (!pickup || !dropoff) return;
    (async () => {
      setLoading(true);
      try {
        const [route, fare] = await Promise.all([
          mapProvider.getRoute(pickup.location, dropoff.location),
          TripApi.estimateFare({
            pickupLatitude: pickup.location.latitude,
            pickupLongitude: pickup.location.longitude,
            dropoffLatitude: dropoff.location.latitude,
            dropoffLongitude: dropoff.location.longitude,
          }),
        ]);
        tripStore.setRoute(route);
        tripStore.setFareEstimate(fare);
      } finally {
        setLoading(false);
      }
    })();
  }, [pickup?.location.latitude, pickup?.location.longitude, dropoff?.location.latitude, dropoff?.location.longitude]);

  const handleRequestRide = async () => {
    setRequesting(true);
    try {
      // Resolve generic placeholder addresses before sending to backend
      const GENERIC_ADDRESSES = ['Current Location', 'Unknown location', 'Selected Location'];
      const { selectedPickup, selectedDropoff } = useTripStore.getState();

      if (selectedPickup && GENERIC_ADDRESSES.includes(selectedPickup.address)) {
        try {
          const resolved = await mapProvider.reverseGeocode(selectedPickup.location);
          if (resolved && resolved !== 'Unknown location') {
            tripStore.setPickup({ location: selectedPickup.location, address: resolved });
          }
        } catch {
          // Keep original address — don't block the ride request
        }
      }

      if (selectedDropoff && GENERIC_ADDRESSES.includes(selectedDropoff.address)) {
        try {
          const resolved = await mapProvider.reverseGeocode(selectedDropoff.location);
          if (resolved && resolved !== 'Unknown location') {
            tripStore.setDropoff({ location: selectedDropoff.location, address: resolved });
          }
        } catch {
          // Keep original address
        }
      }

      await requestTrip((tripId: string) => {
        router.replace(`/(rider)/trip/${tripId}`);
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request ride');
    } finally {
      setRequesting(false);
    }
  };


  if (!pickup || !dropoff) return null;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      {/* Back button */}
      <View className="absolute top-12 start-4 z-20">
        <TouchableOpacity
          onPress={() => router.back()}
          accessible
          accessibilityLabel="رجوع"
          accessibilityRole="button"
          className="bg-zinc-900/90 p-3 rounded-full border border-zinc-800"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        <AppMapView
          center={pickup.location}
          zoom={12}
          style={StyleSheet.absoluteFill}
        >
          <PickupDropoffPins
            pickup={{ ...pickup.location, address: pickup.address }}
            dropoff={{ ...dropoff.location, address: dropoff.address }}
          />
          {currentLocation && <LocationMarker coordinate={currentLocation} />}
          {tripStore.route && (
            <RoutePolyline coordinates={tripStore.route.coordinates} />
          )}
          {nearbyDrivers.map((d) => (
            <CarMarker
              key={d.id}
              id={d.id}
              coordinate={{ latitude: d.lat, longitude: d.lng }}
            />
          ))}
        </AppMapView>

        {/* Loading overlay */}
        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/30 z-10">
            <View className="bg-zinc-900 rounded-2xl p-6 items-center">
              <ActivityIndicator color="#10b981" size="large" />
              <Text className="text-white text-sm mt-3">Calculating route...</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
        {/* Pickup / Dropoff addresses */}
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 me-3" />
            <Text className="text-zinc-300 text-sm flex-1" numberOfLines={1}>
              {pickup.address}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-red-500 me-3" />
            <Text className="text-zinc-300 text-sm flex-1" numberOfLines={1}>
              {dropoff.address}
            </Text>
          </View>
        </View>

        {/* Route + fare info */}
        {tripStore.route && tripStore.fareEstimate && (
          <View className="flex-row justify-between mb-4 bg-zinc-900 rounded-2xl p-4">
            <View className="flex-row items-center">
              <Ionicons name="navigate" size={18} color="#3b82f6" />
              <View className="ms-2">
                <Text className="text-zinc-400 text-xs">
                  {(tripStore.route.distanceMeters / 1000).toFixed(1)} km
                </Text>
                <Text className="text-zinc-400 text-xs">
                  {Math.round(tripStore.route.durationSeconds / 60)} min
                </Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-white text-2xl font-bold">
                {tripStore.fareEstimate.estimatedFare.toLocaleString()} EGP
              </Text>
            </View>
          </View>
        )}

        {/* Payment method */}
        <View className="bg-zinc-900 rounded-2xl p-4 flex-row items-center mb-4">
          <Ionicons name="cash" size={20} color="#10b981" />
          <Text className="text-white font-medium ms-2">Cash</Text>
        </View>

        {/* Request button */}
        <TouchableOpacity
          onPress={handleRequestRide}
          disabled={loading || requesting}
          accessible
          accessibilityLabel={requesting ? 'جاري طلب الرحلة' : 'طلب رحلة'}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || requesting }}
          className={`py-4 rounded-xl items-center ${loading || requesting ? 'bg-zinc-700' : 'bg-emerald-500'}`}
        >
          {requesting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-lg font-bold">Request Ride</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    backgroundColor: '#09090b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
  },
});
