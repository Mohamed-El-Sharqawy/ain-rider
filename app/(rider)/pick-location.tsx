import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../../stores/trip.store';
import { useLocation } from '../../hooks/useLocation';
import { mapProvider } from '../../services/map';
import { AppMapView, type AppMapViewRef } from '../../components/map/MapView';

export default function PickLocationScreen() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field: 'pickup' | 'dropoff' }>();
  const tripStore = useTripStore();
  const { currentLocation } = useLocation();
  const mapRef = useRef<AppMapViewRef>(null);

  const isPickup = field === 'pickup';
  const label = isPickup ? 'pickup' : 'drop-off';

  const [address, setAddress] = useState('Move the map to select');
  const [coordinate, setCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial center: existing selection > current location > Baghdad
  const initialCenter = (isPickup ? tripStore.selectedPickup?.location : tripStore.selectedDropoff?.location)
    || currentLocation
    || { latitude: 30.147719, longitude: 31.394327 };

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const result = await mapProvider.reverseGeocode({ latitude: lat, longitude: lng });
      setAddress(result);
    } catch {
      setAddress('Unknown location');
    } finally {
      setResolving(false);
    }
  }, []);

  // Reverse geocode initial center
  useEffect(() => {
    setCoordinate(initialCenter);
    reverseGeocode(initialCenter.latitude, initialCenter.longitude);
  }, []);

  const handleRegionChange = useCallback((feature: any) => {
    try {
      const bounds = feature?.properties?.visibleBounds;
      if (!bounds || bounds.length < 2) return;

      // Calculate center from visible bounds
      const [[neLng, neLat], [swLng, swLat]] = bounds;
      const centerLat = (neLat + swLat) / 2;
      const centerLng = (neLng + swLng) / 2;

      setCoordinate({ latitude: centerLat, longitude: centerLng });

      // Debounce reverse geocode
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        reverseGeocode(centerLat, centerLng);
      }, 500);
    } catch {
      // ignore
    }
  }, [reverseGeocode]);

  const handleConfirm = () => {
    if (!coordinate) return;
    const data = { location: coordinate, address };

    if (isPickup) {
      tripStore.setPickup(data);
    } else {
      tripStore.setDropoff(data);
    }

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      {/* Header */}
      <View className="absolute top-12 left-4 right-4 z-20 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-zinc-900/90 p-3 rounded-full border border-zinc-800"
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View className="flex-1 ml-3 bg-zinc-900/90 rounded-2xl px-4 py-3 border border-zinc-800">
          <Text className="text-zinc-400 text-xs">
            {isPickup ? 'Set pickup location' : 'Set drop-off location'}
          </Text>
        </View>
      </View>

      {/* Map */}
      <View className="flex-1">
        <AppMapView
          ref={mapRef}
          center={initialCenter}
          zoom={15}
          style={StyleSheet.absoluteFill}
          onRegionChange={handleRegionChange}
        />

        {/* Center pin — fixed in the middle of the screen */}
        <View style={styles.centerPin} pointerEvents="none">
          <Ionicons
            name="location"
            size={40}
            color={isPickup ? '#10b981' : '#ef4444'}
          />
        </View>
      </View>

      {/* Bottom card */}
      <View style={styles.bottomCard}>
        <View className="flex-row items-center mb-4">
          <View
            className={`w-3 h-3 rounded-full mr-3 ${isPickup ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          <View className="flex-1">
            {resolving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#71717a" />
                <Text className="text-zinc-500 text-sm ml-2">Resolving address...</Text>
              </View>
            ) : (
              <Text className="text-white text-sm" numberOfLines={2}>
                {address}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={!coordinate || resolving}
          className={`py-4 rounded-xl items-center ${!coordinate || resolving ? 'bg-zinc-700' : isPickup ? 'bg-emerald-500' : 'bg-red-500'
            }`}
        >
          <Text className="text-white text-base font-bold">
            Confirm {label} location
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    zIndex: 10,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09090b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
});
