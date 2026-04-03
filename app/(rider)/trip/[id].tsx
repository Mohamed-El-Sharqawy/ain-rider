import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../../../stores/trip.store';
import { useTrip } from '../../../hooks/useTrip';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { AppMapView } from '../../../components/map/MapView';
import { DriverMarker } from '../../../components/map/DriverMarker';
import { LocationMarker } from '../../../components/map/LocationMarker';
import { RoutePolyline } from '../../../components/map/RoutePolyline';
import { PickupDropoffPins } from '../../../components/map/PickupDropoffPins';
import { SettingsApi } from '../../../lib/api/settings.api';

export default function TripScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tripStore = useTripStore();
  const { cancelTrip } = useTrip();
  const { on: wsOn } = useWebSocket(true);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);

  const phase = tripStore.phase;
  const driver = tripStore.driver;
  const activeTrip = tripStore.activeTrip;
  const route = tripStore.route;

  useEffect(() => {
    const fetchReasons = async () => {
      setLoadingReasons(true);
      try {
        const list = await SettingsApi.getCancellationReasons('en'); // Default to English
        setReasons(list);
      } catch (err) {
        console.error('Failed to fetch reasons:', err);
      } finally {
        setLoadingReasons(false);
      }
    };
    fetchReasons();
  }, []);

  useEffect(() => {
    const u1 = wsOn('trip_matched', (data: any) => {
      tripStore.setDriver({
        driverId: data.driverId,
        name: data.driverName,
        phone: data.driverPhone,
        rating: data.driverRating,
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vehiclePlate: data.vehiclePlate,
        estimatedArrival: data.estimatedArrival,
        location: null,
      });
      tripStore.setPhase('matched');
    });
    const u2 = wsOn('driver_location_update', (data: any) => {
      tripStore.updateDriverLocation({
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      });
    });
    const u3 = wsOn('trip_started', () => tripStore.setPhase('in_progress'));
    const u4 = wsOn('trip_completed', () => tripStore.setPhase('completed'));
    const u5 = wsOn('trip_cancelled', () => {
      tripStore.reset();
      router.replace('/(rider)/(tabs)/home');
    });
    const u6 = wsOn('trip_no_match', (data: any) => {
      Alert.alert('No Drivers Available', data?.reason === 'NO_DRIVERS_AVAILABLE'
        ? 'No drivers are available nearby. Please try again later.'
        : 'Unable to find a driver for your trip.');
      tripStore.reset();
      router.replace('/(rider)/(tabs)/home');
    });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [wsOn]);

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    try {
      await cancelTrip(tripId, reason);
      setShowCancelModal(false);
      router.replace('/(rider)/(tabs)/home');
    } catch (err) {
      Alert.alert('Error', 'Failed to cancel trip. Please try again.');
    }
  };

  const defaultCenter = { latitude: 33.3152, longitude: 44.3661 };
  const mapCenter = driver?.location || activeTrip?.pickupLocation || defaultCenter;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <View className="flex-1">
        <AppMapView center={mapCenter} zoom={12} style={StyleSheet.absoluteFill}>
          {activeTrip && (
            <PickupDropoffPins
              pickup={{ ...activeTrip.pickupLocation, address: 'Pickup' }}
              dropoff={{ ...activeTrip.dropoffLocation, address: 'Dropoff' }}
            />
          )}
          <LocationMarker coordinate={activeTrip?.pickupLocation || defaultCenter} />
          {driver?.location && <DriverMarker id="active-driver" coordinate={driver.location} />}
          {route && <RoutePolyline coordinates={route.coordinates} />}
        </AppMapView>

        <View style={styles.sheet}>
          {phase === 'matching' && (
            <View className="items-center py-4">
              <ActivityIndicator color="#10b981" size="large" />
              <Text className="text-white text-lg font-medium mt-4 text-center">Looking for a driver...</Text>
              <TouchableOpacity onPress={handleCancelClick} className="bg-red-500/20 py-3 rounded-xl mt-4">
                <Text className="text-red-400 font-medium text-center">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'matched' && driver && (
            <View>
              <View className="flex-row items-center mb-3">
                <View className="bg-zinc-800 p-2 rounded-full mr-3">
                  <Ionicons name="person" size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold">{driver.name}</Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text className="text-zinc-400 text-sm ml-1">{driver.rating.toFixed(1)}</Text>
                  </View>
                  <Text className="text-zinc-500 text-xs mt-1">
                    {driver.vehicleMake} {driver.vehicleModel} · {driver.vehiclePlate}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center mt-2">
                <Ionicons name="time" size={14} color="#3b82f6" />
                <Text className="text-zinc-400 text-xs ml-1">{driver.estimatedArrival} min away</Text>
              </View>
              <TouchableOpacity onPress={handleCancelClick} className="bg-red-500/20 py-3 rounded-xl mt-4">
                <Text className="text-red-400 font-medium text-center">Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'in_progress' && (
            <View>
              <Text className="text-emerald-400 font-bold text-sm mb-2">Trip in Progress</Text>
              <Text className="text-white text-xl font-bold">
                {(route?.distanceMeters || 0) > 1000
                  ? `${((route?.distanceMeters || 0) / 1000).toFixed(1)} km`
                  : `${route?.distanceMeters || 0} m`}
              </Text>
              <Text className="text-zinc-400 text-sm">
                {Math.round((route?.durationSeconds || 0) / 60)} min remaining
              </Text>
            </View>
          )}

          {phase === 'completed' && (
            <View>
              <Text className="text-white text-xl font-bold mb-3">Trip Completed</Text>
              <View className="bg-zinc-800 rounded-2xl p-4 mb-4">
                <Text className="text-zinc-400 text-sm">Fare</Text>
                <Text className="text-white text-2xl font-bold">
                  {activeTrip?.estimatedFare.toLocaleString()} IQD
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(rider)/trip/rate')}
                className="bg-emerald-500 py-3 rounded-xl"
              >
                <Text className="text-white font-bold text-center">Rate Driver</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-zinc-900 rounded-t-3xl p-6 pb-10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Why cancel?</Text>
              <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                <Ionicons name="close" size={24} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            {loadingReasons ? (
              <ActivityIndicator color="#10b981" className="my-10" />
            ) : (
              <FlatList
                data={reasons}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleConfirmCancel(item)}
                    className="flex-row items-center justify-between py-4 border-b border-zinc-800"
                  >
                    <Text className="text-zinc-200 text-base">{item}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#52525b" />
                  </TouchableOpacity>
                )}
                scrollEnabled={reasons.length > 5}
              />
            )}

            <TouchableOpacity
              onPress={() => setShowCancelModal(false)}
              className="mt-6 py-4 rounded-xl border border-zinc-800"
            >
              <Text className="text-zinc-400 font-medium text-center">Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09090b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
});
