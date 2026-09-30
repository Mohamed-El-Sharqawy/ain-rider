import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Animated, Dimensions, Modal, AppState, type AppStateStatus } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as ExpoLocation from 'expo-location';
import * as Notifications from 'expo-notifications';
import { DriverApi } from '../../../lib/api/driver';
import { AuthApi } from '../../../lib/api/auth';
import { useAuthStore } from '../../../stores/auth.store';
import { useDriverStore } from '../../../stores/driver.store';
import { useLocation } from '../../../hooks/useLocation';
import { LocationApi } from '../../../lib/api/location.api';
import { MatchApi } from '../../../lib/api/match.api';
import { AppMapView, AppMapViewRef } from '../../../components/map/MapView';
import { LocationMarker } from '../../../components/map/LocationMarker';
import { PickupDropoffPins } from '../../../components/map/PickupDropoffPins';
import { wsService } from '../../../services/websocket.service';
import { locationService } from '../../../services/location.service';
import { ApiConfig } from '../../../lib/config/constants';

const WS_URL = ApiConfig.wsUrl;

export default function DriverHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [incomingTrip, setIncomingTrip] = useState<any>(null);
  const { logout } = useAuthStore();
  const driverStore = useDriverStore();
  const { currentLocation, startTracking, stopTracking } = useLocation();
  const mapRef = useRef<AppMapViewRef>(null);
  const lastMatchUpdateRef = useRef<number>(0);
  const driverInfoRef = useRef<any>(null);
  const wsUnsubsRef = useRef<(() => void)[]>([]);
  const isOnlineRef = useRef(false);
  const mountedRef = useRef(true);

  const screenHeight = Dimensions.get('window').height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showIncoming, setShowIncoming] = useState(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  // Pause animations when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        // App going to background - animations automatically pause
      } else if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // App coming to foreground
        // If WS died during background and driver has an active trip, reconnect
        if (!wsService.isConnected() && (isOnlineRef.current || driverStore.currentTrip)) {
          wsService.reconnect().catch(() => { });
        }

        // Refresh location and match registration if online
        if (isOnlineRef.current && driverInfoRef.current) {
          locationService.getCurrentLocation().then((loc) => {
            MatchApi.registerAvailable({
              ...driverInfoRef.current!,
              latitude: loc.latitude,
              longitude: loc.longitude,
            }).catch(() => { });
            LocationApi.updateDriverLocation({
              latitude: loc.latitude,
              longitude: loc.longitude,
              heading: loc.heading,
              speed: loc.speed,
            }).catch(() => { });
          }).catch(() => { });
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (incomingTrip) {
      setShowIncoming(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Fit map to show both driver and pickup
      if (currentLocation && mapRef.current) {
        const coords: [number, number][] = [
          [currentLocation.longitude, currentLocation.latitude],
          [incomingTrip.pickupLng, incomingTrip.pickupLat],
        ];
        // Calculate bounds
        const lons = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        const ne: [number, number] = [Math.max(...lons), Math.max(...lats)];
        const sw: [number, number] = [Math.min(...lons), Math.min(...lats)];

        // Safety check for valid coordinates and bounds
        if (!isNaN(ne[0]) && !isNaN(ne[1]) && !isNaN(sw[0]) && !isNaN(sw[1])) {
          mapRef.current.fitBounds(ne, sw, 100);
        } else {
          console.warn('[DriverHome] Invalid coordinates for fitBounds:', { ne, sw });
        }
      }
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowIncoming(false);
      });
    }
  }, [incomingTrip, screenHeight]);

  useEffect(() => {
    if (isOnline && followUser && currentLocation && mapRef.current) {
      mapRef.current.flyTo(currentLocation);
    }
  }, [currentLocation, isOnline, followUser]);

  useEffect(() => {
    return () => {
      // Only tear down WS and tracking if the driver does NOT have an active trip.
      // When navigating to the trip screen, home unmounts but the trip is still live.
      if (isOnlineRef.current && !useDriverStore.getState().currentTrip) {
        locationService.stopBackgroundTracking().catch(() => { });
        stopTracking();
        wsUnsubsRef.current.forEach(fn => fn());
        wsService.disconnect();
        isOnlineRef.current = false;
      }
    };
  }, []);

  const goOnline = async () => {
    try {
      const { status: bgStatus } = await ExpoLocation.getBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        setShowDisclosureModal(true);
        return;
      }
    } catch {
      setShowDisclosureModal(true);
      return;
    }
    await proceedOnline();
  };

  const handleDisclosureAccept = async () => {
    setShowDisclosureModal(false);
    try {
      const { status } = await ExpoLocation.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Background location permission is required to receive trip requests while the app is in the background.');
        return;
      }
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: true },
      });
      await proceedOnline();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to request permissions');
    }
  };

  const handleDisclosureDeny = () => {
    setShowDisclosureModal(false);
  };

  const proceedOnline = async () => {
    setIsLoading(true);
    setFollowUser(true);
    try {
      wsService.connect(WS_URL);

      const [, loc, me, onboarding] = await Promise.all([
        DriverApi.updateStatus(true),
        locationService.getCurrentLocation(),
        AuthApi.getMe(),
        DriverApi.getOnboardingStatus(),
      ]);

      LocationApi.updateDriverLocation({
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: loc.speed,
      }).catch(() => { });

      await wsService.waitForConnection();
      wsService.subscribe('driver', me.id);

      wsUnsubsRef.current.forEach(fn => fn());
      wsUnsubsRef.current = [];
      const unsubAssigned = wsService.on('trip_assigned', (data: any) => {
        setIncomingTrip({
          id: data.tripId,
          riderId: data.riderId,
          riderName: data.riderName,
          riderRating: data.riderRating,
          pickupLat: data.pickupLocation?.latitude || data.pickupLocation?.lat,
          pickupLng: data.pickupLocation?.longitude || data.pickupLocation?.lng,
          dropoffLat: data.dropoffLocation?.latitude || data.dropoffLocation?.lat,
          dropoffLng: data.dropoffLocation?.longitude || data.dropoffLocation?.lng,
          pickupAddress: data.pickupAddress,
          dropoffAddress: data.dropoffAddress,
          estimatedFare: data.estimatedFare,
          estimatedDuration: data.estimatedDuration,
          riderPhone: data.riderPhone,
          status: 'ASSIGNED',
        });
      });
      const unsubCancelled = wsService.on('trip_cancelled', () => {
        setIncomingTrip(null);
      });
      wsUnsubsRef.current = [unsubAssigned, unsubCancelled];

      const vehicle = onboarding.documents?.vehicle?.details;
      const matchInfo = {
        latitude: loc.latitude,
        longitude: loc.longitude,
        vehicleTypeId: 'default',
        driverName: `${me.firstName} ${me.lastName}`,
        driverPhone: me.phoneNumber,
        vehicleMake: vehicle?.make,
        vehicleModel: vehicle?.model,
        vehiclePlate: vehicle?.plateNumber,
      };
      driverInfoRef.current = matchInfo;
      await MatchApi.registerAvailable(matchInfo);
      lastMatchUpdateRef.current = Date.now();
      startTracking(async (update) => {
        try {
          await LocationApi.updateDriverLocation({
            latitude: update.latitude,
            longitude: update.longitude,
            heading: update.heading,
            speed: update.speed,
          });
          const now = Date.now();
          if (now - lastMatchUpdateRef.current >= 60_000 && driverInfoRef.current) {
            lastMatchUpdateRef.current = now;
            await MatchApi.registerAvailable({
              ...driverInfoRef.current,
              latitude: update.latitude,
              longitude: update.longitude,
            });
          }
        } catch { }
      });

      await locationService.startBackgroundTracking();

      setIsOnline(true);
      isOnlineRef.current = true;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to go online');
    } finally {
      setIsLoading(false);
    }
  };

  // Instant re-availability after trip ends
  useEffect(() => {
    if (isOnline && !driverStore.currentTrip && driverInfoRef.current) {
      const triggerAvailability = async () => {
        try {
          const loc = await locationService.getCurrentLocation();
          await MatchApi.registerAvailable({
            ...driverInfoRef.current,
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
          lastMatchUpdateRef.current = Date.now();
        } catch (err) {
          console.error('[DriverHome] Failed instant re-availability:', err);
        }
      };
      triggerAvailability();
    }
  }, [driverStore.currentTrip, isOnline]);

  const goOffline = async () => {
    setIsLoading(true);
    try {
      try {
        const me = await AuthApi.getMe();
        if (me.status === 'SUSPENDED' || me.status === 'DELETED') {
          if (mountedRef.current) {
            Alert.alert('تم تعليق الحساب', 'لا يمكنك تغيير الحالة. يرجى التواصل مع الدعم.');
            setIsOnline(false);
          }
          isOnlineRef.current = false;
          return;
        }
      } catch {
        // If getMe fails (network), proceed with offline anyway
      }

      await DriverApi.updateStatus(false);
      await MatchApi.unregisterAvailable();
      stopTracking();
      await locationService.stopBackgroundTracking();
      wsUnsubsRef.current.forEach(fn => fn());
      wsUnsubsRef.current = [];
      wsService.disconnect();
      if (mountedRef.current) {
        setIsOnline(false);
      }
      isOnlineRef.current = false;
    } catch (error: any) {
      if (mountedRef.current) {
        Alert.alert('Error', error.message || 'Failed to go offline');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleAcceptTrip = async () => {
    if (!incomingTrip) return;
    try {
      // 1. Tell match-service driver accepted (unblocks the match loop)
      await MatchApi.respondToTrip(incomingTrip.id, 'accept');

      // 2. Update local state
      driverStore.setCurrentTrip({
        tripId: incomingTrip.id,
        riderId: incomingTrip.riderId,
        pickupLocation: { latitude: incomingTrip.pickupLat, longitude: incomingTrip.pickupLng },
        dropoffLocation: { latitude: incomingTrip.dropoffLat, longitude: incomingTrip.dropoffLng },
        pickupAddress: incomingTrip.pickupAddress,
        dropoffAddress: incomingTrip.dropoffAddress,
        status: 'MATCHED',
        estimatedDuration: incomingTrip.estimatedDuration || 0,
        estimatedFare: incomingTrip.estimatedFare || 0,
        riderName: incomingTrip.riderName || 'Rider',
        riderPhone: incomingTrip.riderPhone || '',
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
      await MatchApi.respondToTrip(incomingTrip.id, 'reject');
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
            <View className={`w-2 h-2 rounded-full me-2 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
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
            style={StyleSheet.absoluteFillObject}
            onRegionChange={(e) => {
              if (e.properties.isUserInteraction) {
                setFollowUser(false);
              }
            }}
          >
            {currentLocation && <LocationMarker coordinate={currentLocation} type="driver" />}
            {incomingTrip && (
              <PickupDropoffPins
                pickup={{ latitude: incomingTrip.pickupLat, longitude: incomingTrip.pickupLng, address: 'Pickup' }}
                dropoff={{ latitude: incomingTrip.dropoffLat, longitude: incomingTrip.dropoffLng, address: 'Dropoff' }}
              />
            )}
          </AppMapView>

          <TouchableOpacity
            onPress={goOffline}
            disabled={isLoading}
            className="absolute top-4 right-4 bg-zinc-900/90 px-3 py-2 rounded-xl border border-zinc-800"
          >
            <Ionicons name="power" size={20} color="#ef4444" />
            <Text className="text-red-400 text-xs font-medium ms-1">Go Offline</Text>
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

      <Modal
        visible={showDisclosureModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
      >
        <View style={styles.disclosureOverlay}>
          <View style={styles.disclosureContainer}>
            <View className="w-12 h-1.5 bg-zinc-800 rounded-full self-center mb-6" />
            <View className="w-14 h-14 rounded-full bg-emerald-500/20 items-center justify-center self-center mb-6">
              <Ionicons name="location" size={28} color="#10b981" />
            </View>
            <Text className="text-white text-xl font-black text-center mb-4">
              Background Location Required
            </Text>
            <Text className="text-zinc-400 text-sm text-center leading-6 mb-8">
              Ain Rider collects location data to enable tracking your active trips and matching you with new ride requests even when the app is closed or not in use.
            </Text>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={handleDisclosureDeny}
                className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-2xl items-center"
              >
                <Text className="text-zinc-400 font-bold">DENY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDisclosureAccept}
                className="flex-1 bg-emerald-500 py-4 rounded-2xl items-center shadow-lg shadow-emerald-500/20"
              >
                <Text className="text-white font-bold">ACCEPT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showIncoming && (
        <>
          {/* Semi-transparent overlay — lets map show through */}
          <Animated.View
            style={[
              styles.incomingOverlay,
              { opacity: fadeAnim }
            ]}
            pointerEvents="none"
          />

          {/* Bottom sheet — slides up from below */}
          <Animated.View
            style={[
              styles.incomingSheet,
              {
                paddingBottom: (insets.bottom || 24) + 32,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View className="w-12 h-1.5 bg-zinc-800 rounded-full self-center mb-8" />
            <Text className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-2">Incoming Trip</Text>
            <Text className="text-white text-2xl font-black mb-6">New Ride Request</Text>

            <View className="flex-row items-center bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 mb-6">
              <View className="w-12 h-12 bg-emerald-500/10 rounded-full items-center justify-center me-4">
                <Ionicons name="person" size={24} color="#10b981" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-black text-lg">{incomingTrip?.riderName || 'Rider'}</Text>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text className="text-zinc-400 text-xs ms-1 font-bold">{(incomingTrip?.riderRating ?? 5.0).toFixed(1)} Rating</Text>
                </View>
              </View>
            </View>

            <View className="mb-8">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center me-3">
                  <Ionicons name="location" size={16} color="#10b981" />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase">Pickup</Text>
                  <Text className="text-white font-bold" numberOfLines={1}>{incomingTrip?.pickupAddress}</Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-blue-500/20 items-center justify-center me-3">
                  <Ionicons name="arrow-forward" size={16} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase">Destination</Text>
                  <Text className="text-white font-bold" numberOfLines={1}>{incomingTrip?.dropoffAddress}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-center justify-between mb-8 px-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-blue-500/10 items-center justify-center me-3">
                  <Ionicons name="time" size={16} color="#3b82f6" />
                </View>
                <View>
                  <Text className="text-zinc-500 text-[10px] font-bold uppercase">Estimated</Text>
                  <Text className="text-white font-bold">
                    {incomingTrip?.estimatedDuration ? `${Math.round(incomingTrip.estimatedDuration / 60)} min` : '5 min'} · {incomingTrip?.estimatedFare?.toLocaleString()} EGP
                  </Text>
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
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  incomingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 90,
  },
  incomingSheet: {
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
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 100,
  },
  disclosureOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  disclosureContainer: {
    backgroundColor: '#09090b',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
});
