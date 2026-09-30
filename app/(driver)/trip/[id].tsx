import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Linking, Platform, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { useDriverStore } from '../../../stores/driver.store';
import { useLocation } from '../../../hooks/useLocation';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { TripApi } from '../../../lib/api/trip.api';
import { mapProvider } from '../../../services/map';
import { AppMapView } from '../../../components/map/MapView';
import { RoutePolyline } from '../../../components/map/RoutePolyline';
import { LocationMarker } from '../../../components/map/LocationMarker';
import { PickupDropoffPins } from '../../../components/map/PickupDropoffPins';
import { LatLng } from '../../../services/map/map.provider';

export default function DriverTripScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const driverStore = useDriverStore();
  const { currentLocation } = useLocation();
  const { on: wsOn } = useWebSocket();
  const insets = useSafeAreaInsets();
  const [tripStatus, setTripStatus] = useState('arriving');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const currentTrip = driverStore.currentTrip;

  const slideAnim = useRef(new Animated.Value(300)).current;

  // ── Trip Recovery: if store lost the trip (e.g. after background kill), re-fetch from API ──
  useEffect(() => {
    if (currentTrip || !tripId) return;
    const recover = async () => {
      try {
        const trip = await TripApi.getTrip(tripId);
        if (trip && trip.status !== 'COMPLETED' && trip.status !== 'CANCELLED') {
          driverStore.setCurrentTrip({
            tripId: trip.id,
            riderId: trip.riderId,
            pickupLocation: { latitude: trip.pickupLat, longitude: trip.pickupLng },
            dropoffLocation: { latitude: trip.dropoffLat, longitude: trip.dropoffLng },
            pickupAddress: trip.pickupAddress || 'Pickup',
            dropoffAddress: trip.dropoffAddress || 'Dropoff',
            status: trip.status,
            estimatedDuration: trip.duration || 0,
            estimatedFare: trip.estimatedFare || 0,
            riderName: trip.riderName || 'Rider',
            riderPhone: trip.riderPhone || '',
          });
          if (trip.status === 'IN_PROGRESS') {
            setTripStatus('in_progress');
          }
        } else {
          // Trip is over — go back
          router.replace('/(driver)/(tabs)/home');
        }
      } catch {
        Alert.alert('Error', 'Could not recover trip data.');
        router.replace('/(driver)/(tabs)/home');
      }
    };
    recover();
  }, [tripId, currentTrip]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!currentTrip) return;
    const fetchRoute = () => {
      const target = tripStatus === 'arriving'
        ? currentTrip.pickupLocation
        : currentTrip.dropoffLocation;
      const origin = currentLocation || currentTrip.pickupLocation;
      setRouteError(null);
      mapProvider.getRoute(origin, target)
        .then((r) => setRouteCoords(r.coordinates))
        .catch(() => setRouteError('Could not recalculate route. Navigation may be inaccurate.'));
    };
    fetchRoute();
    const interval = setInterval(fetchRoute, 30000);
    const unsubStarted = wsOn('trip_started', () => setTripStatus('in_progress'));
    const unsubCancelled = wsOn('trip_cancelled', (data: any) => {
      if (data.tripId === currentTrip.tripId) {
        Alert.alert('Trip Cancelled', 'The rider has cancelled this trip.');
        driverStore.setCurrentTrip(null);
        router.replace('/(driver)/(tabs)/home');
      }
    });
    return () => {
      clearInterval(interval);
      unsubStarted();
      unsubCancelled();
    };
  }, [tripStatus, currentTrip?.tripId]);

  const handleStartTrip = async () => {
    if (isUpdating) return;
    try {
      setIsUpdating(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await TripApi.updateTripStatus(tripId, 'IN_PROGRESS');
      setTripStatus('in_progress');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start trip');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (isUpdating) return;
    try {
      setIsUpdating(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await TripApi.updateTripStatus(tripId, 'COMPLETED');
      driverStore.setCurrentTrip(null);
      driverStore.reset();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(driver)/(tabs)/home');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete trip');
      setIsUpdating(false);
    }
  };

  // ── Navigate: open native maps with turn-by-turn directions ──
  const handleNavigate = () => {
    if (!currentTrip) return;
    const target = tripStatus === 'arriving'
      ? currentTrip.pickupLocation
      : currentTrip.dropoffLocation;

    const { latitude, longitude } = target;

    let url: string;
    if (Platform.OS === 'ios') {
      // Apple Maps with driving directions
      url = `maps://app?daddr=${latitude},${longitude}&dirflg=d`;
    } else {
      // Google Maps navigation mode
      url = `google.navigation:q=${latitude},${longitude}&mode=d`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        }
        // Fallback to web Google Maps
        return Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
        );
      })
      .catch(() => {
        Alert.alert('Error', 'Could not open navigation app.');
      });
  };

  if (!currentTrip) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-white">No trip assigned</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <View className="flex-1">
        <AppMapView
          center={currentLocation || currentTrip.pickupLocation}
          zoom={12}
          style={StyleSheet.absoluteFill}
        >
          {currentLocation && <LocationMarker coordinate={currentLocation} />}
          <PickupDropoffPins
            pickup={{ ...currentTrip.pickupLocation, address: currentTrip.pickupAddress }}
            dropoff={{ ...currentTrip.dropoffLocation, address: currentTrip.dropoffAddress }}
          />
          {routeCoords.length > 0 && <RoutePolyline coordinates={routeCoords} />}
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

          {routeError && (
            <View className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 mb-4 flex-row items-center">
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text className="text-red-400 text-xs ms-2 flex-1">{routeError}</Text>
              <TouchableOpacity onPress={() => {
                setRouteError(null);
                const target = tripStatus === 'arriving' ? currentTrip.pickupLocation : currentTrip.dropoffLocation;
                const origin = currentLocation || currentTrip.pickupLocation;
                mapProvider.getRoute(origin, target)
                  .then((r) => setRouteCoords(r.coordinates))
                  .catch(() => setRouteError('Could not recalculate route. Navigation may be inaccurate.'));
              }}>
                <Ionicons name="refresh" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {tripStatus === 'arriving' ? (
            <View>
              <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Current Task</Text>
              <Text className="text-white text-xl font-black mb-1">Heading to pickup</Text>
              <Text className="text-zinc-400 text-sm mb-6" numberOfLines={1}>
                {currentTrip.pickupAddress}
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleNavigate}
                  className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-2xl flex-row items-center justify-center"
                >
                  <Ionicons name="navigate" size={18} color="#3b82f6" />
                  <Text className="text-blue-400 font-bold ms-2">NAVIGATE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStartTrip}
                  disabled={isUpdating}
                  className={`flex-1 ${isUpdating ? 'bg-emerald-500/50' : 'bg-emerald-500'} py-4 rounded-2xl items-center shadow-lg shadow-emerald-500/20`}
                >
                  {isUpdating ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-black">START TRIP</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1">Trip in Progress</Text>
              <Text className="text-white text-xl font-black mb-1">Dropoff Point</Text>
              <Text className="text-zinc-400 text-sm mb-6" numberOfLines={1}>
                {currentTrip.dropoffAddress}
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleNavigate}
                  className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-2xl flex-row items-center justify-center"
                >
                  <Ionicons name="navigate" size={18} color="#3b82f6" />
                  <Text className="text-blue-400 font-bold ms-2">NAVIGATE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCompleteTrip}
                  disabled={isUpdating}
                  className={`flex-1 ${isUpdating ? 'bg-red-500/50' : 'bg-red-500'} py-4 rounded-2xl items-center shadow-lg shadow-red-500/20`}
                >
                  {isUpdating ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-black">COMPLETE TRIP</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
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
