import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, FlatList, Animated, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { TripApi } from '../../../lib/api/trip.api';

export default function TripScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tripStore = useTripStore();
  const { cancelTrip } = useTrip();
  const { on: wsOn, subscribe, unsubscribe } = useWebSocket(true);

  useEffect(() => {
    if (tripId) {
      console.log('[TripScreen] Subscribing to trip channel:', tripId);
      subscribe('trip', `${tripId}:rider`);
    }
    return () => {
      if (tripId) {
        unsubscribe('trip', `${tripId}:rider`);
      }
    };
  }, [tripId, subscribe, unsubscribe]);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const syncTripState = async () => {
      if (!tripId) return;
      try {
        const trip = await TripApi.getTrip(tripId);

        // Sync trip data to store
        tripStore.setActiveTrip({
          tripId: trip.id,
          status: trip.status,
          pickupLocation: { latitude: trip.pickupLat, longitude: trip.pickupLng },
          dropoffLocation: { latitude: trip.dropoffLat, longitude: trip.dropoffLng },
          estimatedFare: trip.estimatedFare,
        });

        if (trip.status === 'MATCHED' || trip.status === 'ARRIVING') {
          tripStore.setPhase('matched');
          if (trip.driverId && trip.driverName) {
            tripStore.setDriver({
              driverId: trip.driverId,
              name: trip.driverName,
              phone: trip.driverPhone || '',
              rating: trip.driverRating || 5,
              vehicleMake: trip.vehicleMake || '',
              vehicleModel: trip.vehicleModel || '',
              vehiclePlate: trip.vehiclePlate || '',
              estimatedArrival: 5, // Fallback
              location: null,
            });
          }
        } else if (trip.status === 'IN_PROGRESS') {
          tripStore.setPhase('in_progress');
        } else if (trip.status === 'COMPLETED') {
          tripStore.setPhase('completed');
        }
      } catch (err) {
        console.error('Failed to sync trip state:', err);
      } finally {
        setInitializing(false);
      }
    };
    syncTripState();
  }, [tripId]);

  const phase = tripStore.phase;
  const driver = tripStore.driver;
  const activeTrip = tripStore.activeTrip;
  const route = tripStore.route;

  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [phase]); // Re-animate slightly on phase change for a "reactive" feel

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
      console.log('[TripScreen] No match found yet, still searching...', data);
      // We don't reset or redirect anymore, just let the backend keep looking
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

  const defaultCenter = { latitude: 30.147719, longitude: 31.394327 };
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

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: (insets.bottom || 24) + 24,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View className="w-12 h-1.5 bg-zinc-800 rounded-full self-center mb-6" />

          {phase === 'matching' && (
            <View className="items-center py-4">
              <View className="relative">
                <ActivityIndicator color="#10b981" size="large" />
                <View className="absolute inset-0 items-center justify-center">
                  <View className="w-10 h-10 rounded-full border-2 border-emerald-500/20" />
                </View>
              </View>
              <Text className="text-white text-xl font-black mt-6 text-center">Finding Your Ride</Text>
              <Text className="text-zinc-500 text-sm mt-1 text-center">This may take a moment during busy times</Text>

              <TouchableOpacity
                onPress={handleCancelClick}
                className="w-full bg-zinc-900 border border-zinc-800 py-4 rounded-2xl mt-8 flex-row items-center justify-center"
              >
                <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                <Text className="text-zinc-400 font-black ml-2 uppercase tracking-widest text-[10px]">Cancel Search</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'matched' && driver && (
            <View>
              <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Driver Found</Text>
              <Text className="text-white text-xl font-black mb-6">Your ride is on the way</Text>

              <View className="flex-row items-center bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 mb-6">
                <View className="w-12 h-12 bg-emerald-500/10 rounded-full items-center justify-center mr-4">
                  <Ionicons name="person" size={24} color="#10b981" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-black text-lg">{driver.name}</Text>
                  <View className="flex-row items-center mt-0.5">
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text className="text-zinc-400 text-xs ml-1 font-bold">{driver.rating.toFixed(1)} · {driver.vehicleMake} {driver.vehicleModel}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-white font-black text-lg">{driver.vehiclePlate}</Text>
                  <Text className="text-zinc-500 text-[10px] font-bold">PLATE NUMBER</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-8 px-2">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center mr-3">
                    <Ionicons name="time" size={16} color="#3b82f6" />
                  </View>
                  <View>
                    <Text className="text-zinc-500 text-[10px] font-bold uppercase">Arrival</Text>
                    <Text className="text-white font-bold">{driver.estimatedArrival} min away</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => Alert.alert('Calling', `Calling ${driver.phone}...`)} className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full items-center justify-center">
                  <Ionicons name="call" size={20} color="#10b981" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleCancelClick}
                className="w-full bg-zinc-900 border border-zinc-800 py-4 rounded-2xl items-center"
              >
                <Text className="text-red-400/60 font-black uppercase tracking-widest text-[10px]">Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'in_progress' && (
            <View>
              <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Trip Status</Text>
              <Text className="text-white text-xl font-black mb-6">Heading to destination</Text>

              <View className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 mb-6">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase">Estimated Time</Text>
                  <Text className="text-white font-black text-lg">{Math.round((route?.durationSeconds || 0) / 60)} min</Text>
                </View>
                <View className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <View className="h-full bg-emerald-500 w-1/3" />
                </View>
              </View>
            </View>
          )}

          {phase === 'completed' && (
            <View className="py-2">
              <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Arrived</Text>
              <Text className="text-white text-xl font-black mb-6">Trip Completed</Text>

              <View className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10 mb-8 items-center">
                <Text className="text-zinc-500 text-xs font-bold mb-1 uppercase tracking-widest">Total Fare</Text>
                <Text className="text-white text-4xl font-black">
                  {activeTrip?.estimatedFare.toLocaleString()} <Text className="text-emerald-500 text-lg">IQD</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/(rider)/trip/rate')}
                className="bg-emerald-500 py-4 rounded-2xl items-center shadow-lg shadow-emerald-500/20"
              >
                <Text className="text-white font-black uppercase tracking-widest">Rate Your Driver</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
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
    borderTopWidth: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderColor: '#27272a',
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
});
