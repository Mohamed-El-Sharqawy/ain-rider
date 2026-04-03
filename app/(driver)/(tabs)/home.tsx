import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DriverApi } from '../../../lib/api/driver';
import { AuthApi } from '../../../lib/api/auth';
import { useAuthStore } from '../../../stores/auth.store';
import { useDriverStore } from '../../../stores/driver.store';
import { useLocation } from '../../../hooks/useLocation';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { LocationApi } from '../../../lib/api/location.api';
import { MatchApi } from '../../../lib/api/match.api';
import { TripApi } from '../../../lib/api/trip.api';
import { AppMapView, AppMapViewRef } from '../../../components/map/MapView';
import { LocationMarker } from '../../../components/map/LocationMarker';
import { wsService } from '../../../services/websocket.service';
import { locationService } from '../../../services/location.service';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export default function DriverHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [incomingTrip, setIncomingTrip] = useState<any>(null);
  const { logout } = useAuthStore();
  const driverStore = useDriverStore();
  const { currentLocation, startTracking, stopTracking } = useLocation();
  const { on: wsOn } = useWebSocket();
  const mapRef = useRef<AppMapViewRef>(null);

  useEffect(() => {
    if (isOnline && followUser && currentLocation && mapRef.current) {
      mapRef.current.flyTo(currentLocation);
    }
  }, [currentLocation, isOnline, followUser]);

  useEffect(() => {
    if (!isOnline) return;

    const unsubAssigned = wsOn('trip_assigned', async (data: any) => {
      try {
        console.log('[DriverHome] Trip assigned:', data.tripId);
        const tripData = await TripApi.getTrip(data.tripId);
        setIncomingTrip(tripData);
      } catch (error) {
        console.error('Failed to handle trip_assigned:', error);
      }
    });

    const unsubCancelled = wsOn('trip_cancelled', (data: any) => {
      console.log('[DriverHome] Trip cancelled:', data.tripId);
      setIncomingTrip(null);
    });

    return () => { 
      unsubAssigned();
      unsubCancelled();
    };
  }, [isOnline]);

  const goOnline = async () => {
    setIsLoading(true);
    setFollowUser(true);
    try {
      const [, loc, me, onboarding] = await Promise.all([
        DriverApi.updateStatus(true),
        locationService.getCurrentLocation(),
        AuthApi.getMe(),
        DriverApi.getOnboardingStatus(),
      ]);
      await LocationApi.updateDriverLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: loc.speed,
      });
      const vehicle = onboarding.documents?.vehicle?.details;
      await MatchApi.registerAvailable({
        latitude: loc.latitude,
        longitude: loc.longitude,
        vehicleTypeId: 'default',
        driverName: `${me.firstName} ${me.lastName}`,
        driverPhone: me.phoneNumber,
        vehicleMake: vehicle?.make,
        vehicleModel: vehicle?.model,
        vehiclePlate: vehicle?.plateNumber,
      });
      startTracking(async (update) => {
        try {
          await LocationApi.updateDriverLocation({
            latitude: update.latitude,
            longitude: update.longitude,
            heading: update.heading,
            speed: update.speed,
          });
        } catch { }
      });
      
      wsService.connect(WS_URL);
      // Wait 500ms to ensure the connection is stable before subscribing
      await new Promise(r => setTimeout(r, 500));
      console.log('[DriverHome] Subscribing to driver channel with ID:', me.id);
      wsService.subscribe('driver', me.id);
      
      setIsOnline(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to go online');
    } finally {
      setIsLoading(false);
    }
  };

  const goOffline = async () => {
    setIsLoading(true);
    try {
      await DriverApi.updateStatus(false);
      await MatchApi.unregisterAvailable();
      stopTracking();
      wsService.disconnect();
      setIsOnline(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to go offline');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptTrip = async () => {
    if (!incomingTrip) return;
    try {
      driverStore.setCurrentTrip({
        tripId: incomingTrip.id,
        riderId: incomingTrip.riderId,
        pickupLocation: { latitude: incomingTrip.pickupLat, longitude: incomingTrip.pickupLng },
        dropoffLocation: { latitude: incomingTrip.dropoffLat, longitude: incomingTrip.dropoffLng },
        pickupAddress: incomingTrip.pickupAddress,
        dropoffAddress: incomingTrip.dropoffAddress,
        status: incomingTrip.status,
      });
      const tripId = incomingTrip.id;
      setIncomingTrip(null);
      router.push(`/(driver)/trip/${tripId}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept trip');
    }
  };

  const handleRejectTrip = async () => {
    if (!incomingTrip) return;
    try {
      await TripApi.rejectTrip(incomingTrip.id, 'DRIVER_DECLINED');
      setIncomingTrip(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject trip');
    }
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="bg-zinc-900 pt-16 pb-4 px-6 flex-row justify-between items-center">
        <View>
          <Text className="text-zinc-500 text-xs font-black uppercase tracking-widest">Status</Text>
          <View className="flex-row items-center mt-1">
            <View className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            <Text className="text-white font-bold text-lg">{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} className="p-2">
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {isOnline ? (
        <View className="flex-1">
          <AppMapView
            ref={mapRef}
            zoom={14}
            style={StyleSheet.absoluteFill}
            onRegionChange={(e) => {
              if (e.properties.isUserInteraction) {
                setFollowUser(false);
              }
            }}
          >
            {currentLocation && <LocationMarker coordinate={currentLocation} type="driver" />}
          </AppMapView>

          <TouchableOpacity
            onPress={goOffline}
            disabled={isLoading}
            className="absolute top-4 right-4 bg-zinc-900/90 px-3 py-2 rounded-xl border border-zinc-800"
          >
            <Ionicons name="power" size={20} color="#ef4444" />
            <Text className="text-red-400 text-xs font-medium ml-1">Go Offline</Text>
          </TouchableOpacity>

          {!followUser && (
            <TouchableOpacity
              onPress={() => setFollowUser(true)}
              className="absolute bottom-6 right-6 w-12 h-12 bg-emerald-500 rounded-full items-center justify-center shadow-lg"
            >
              <Ionicons name="locate" size={24} color="white" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={1}
            onPressIn={() => setFollowUser(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
          />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-full bg-zinc-900 p-8 rounded-[40px] border border-zinc-800 items-center">
            <Text className="text-zinc-500 text-sm font-bold text-center mb-10">
              Go online to receive trip requests
            </Text>
            <TouchableOpacity
              onPress={goOnline}
              disabled={isLoading}
              className="w-32 h-32 rounded-full items-center justify-center border-8 bg-zinc-950 border-zinc-800 shadow-xl"
            >
              {isLoading ? (
                <ActivityIndicator color="#52525b" size="large" />
              ) : (
                <Ionicons name="power" size={48} color="#3f3f46" />
              )}
            </TouchableOpacity>
            <Text className="mt-8 font-black text-xl tracking-[4px] text-zinc-700">GO ONLINE</Text>
          </View>
        </View>
      )}

      <View 
        style={{ paddingBottom: insets.bottom || 24 }}
        className="flex-row bg-zinc-900 border-t border-zinc-800 py-6"
      >
        <View className="flex-1 border-r border-zinc-800 items-center">
          <Text className="text-zinc-500 text-xs font-bold mb-1">TRIPS</Text>
          <Text className="text-white font-black text-xl">0</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-zinc-500 text-xs font-bold mb-1">EARNINGS</Text>
          <Text className="text-white font-black text-xl">$0.00</Text>
        </View>
      </View>

      {incomingTrip && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { marginBottom: insets.bottom + 20 }]}>
            <Text className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-2">Incoming Trip</Text>
            <Text className="text-white text-2xl font-black mb-6">New Ride Request</Text>

            <View className="mb-8">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                  <Ionicons name="location" size={16} color="#10b981" />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase">Pickup</Text>
                  <Text className="text-white font-bold" numberOfLines={1}>{incomingTrip.pickupAddress}</Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                  <Ionicons name="arrow-forward" size={16} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase">Destination</Text>
                  <Text className="text-white font-bold" numberOfLines={1}>{incomingTrip.dropoffAddress}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={handleRejectTrip}
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-2xl items-center"
              >
                <Text className="text-zinc-400 font-bold">REJECT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAcceptTrip}
                className="flex-1 bg-emerald-500 py-4 rounded-2xl items-center shadow-lg shadow-emerald-500/20"
              >
                <Text className="text-white font-bold">ACCEPT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    padding: 20,
    zIndex: 100,
  },
  modalContainer: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
});
