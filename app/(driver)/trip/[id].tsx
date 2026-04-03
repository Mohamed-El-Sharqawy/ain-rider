import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
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
  const [tripStatus, setTripStatus] = useState('arriving');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const currentTrip = driverStore.currentTrip;

  useEffect(() => {
    if (!currentTrip) return;
    const fetchRoute = () => {
      const target = tripStatus === 'arriving'
        ? currentTrip.pickupLocation
        : currentTrip.dropoffLocation;
      const origin = currentLocation || currentTrip.pickupLocation;
      mapProvider.getRoute(origin, target).then((r) => setRouteCoords(r.coordinates)).catch(() => {});
    };
    fetchRoute();
    const interval = setInterval(fetchRoute, 30000);
    const unsub = wsOn('trip_started', () => setTripStatus('in_progress'));
    return () => { clearInterval(interval); unsub(); };
  }, [tripStatus, currentTrip?.tripId]);

  const handleStartTrip = async () => {
    try {
      await TripApi.updateTripStatus(tripId, 'IN_PROGRESS');
      setTripStatus('in_progress');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start trip');
    }
  };

  const handleCompleteTrip = async () => {
    try {
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
    }
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

        <View style={styles.sheet}>
          {tripStatus === 'arriving' ? (
            <View>
              <Text className="text-white text-lg font-bold mb-1">Heading to pickup</Text>
              <Text className="text-zinc-400 text-sm mb-4" numberOfLines={2}>
                {currentTrip.pickupAddress}
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-blue-500/20 py-3 rounded-xl flex-row items-center justify-center"
                >
                  <Ionicons name="navigate" size={18} color="#3b82f6" />
                  <Text className="text-blue-400 font-medium ml-1">Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStartTrip}
                  className="flex-1 bg-emerald-500 py-3 rounded-xl items-center"
                >
                  <Text className="text-white font-bold">Start Trip</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text className="text-emerald-400 font-bold text-sm mb-2">Trip in Progress</Text>
              <Text className="text-white text-lg font-bold mb-1">{currentTrip.dropoffAddress}</Text>
              <TouchableOpacity
                onPress={handleCompleteTrip}
                className="bg-red-500 py-3 rounded-xl items-center mt-4"
              >
                <Text className="text-white font-bold">Complete Trip</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
});
