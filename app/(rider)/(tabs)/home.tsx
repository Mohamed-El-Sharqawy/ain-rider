import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../../hooks/useLocation';
import { useNearbyDrivers } from '../../../hooks/useNearbyDrivers';
import { AppMapView, AppMapViewRef } from '../../../components/map/MapView';
import { CarMarker } from '../../../components/map/CarMarker';
import { LocationMarker } from '../../../components/map/LocationMarker';
import { DEFAULT_LOCATION } from '../../../lib/config/constants';

export default function RiderHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useKeepAwake();
  const [followUser, setFollowUser] = useState(true);
  const mapRef = useRef<AppMapViewRef>(null);
  const { currentLocation } = useLocation();
  const { drivers } = useNearbyDrivers(
    currentLocation?.latitude,
    currentLocation?.longitude,
  );

  useEffect(() => {
    if (followUser && currentLocation && mapRef.current) {
      mapRef.current.flyTo(currentLocation);
    }
  }, [currentLocation, followUser]);

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <View className="flex-1">
        <AppMapView
          ref={mapRef}
          center={currentLocation || DEFAULT_LOCATION}
          zoom={14}
          style={StyleSheet.absoluteFill}
          onRegionChange={(e) => {
            if (e.properties.isUserInteraction) {
              setFollowUser(false);
            }
          }}
        >
          {currentLocation && <LocationMarker coordinate={currentLocation} type="rider" />}
          {drivers.map((d) => (
            <CarMarker
              key={d.id}
              id={d.id}
              coordinate={{ latitude: d.lat, longitude: d.lng }}
            />
          ))}
        </AppMapView>

        <View className="absolute top-4 start-4 end-4 z-20">
          <TouchableOpacity
            onPress={() => router.push('/(rider)/search')}
            accessible
            accessibilityLabel="البحث عن وجهة"
            accessibilityRole="button"
            className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-4 border border-zinc-800 shadow-2xl"
          >
            <Ionicons name="search" size={20} color="#10b981" />
            <View className="ms-3">
              <Text className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-0.5">Where are you going?</Text>
              <Text className="text-white font-medium">Search for your destination</Text>
            </View>
          </TouchableOpacity>
        </View>

        {!followUser && (
          <TouchableOpacity
            onPress={() => setFollowUser(true)}
            accessible
            accessibilityLabel="متابعة موقعي"
            accessibilityRole="button"
            className="absolute bottom-24 right-6 w-12 h-12 bg-emerald-500 rounded-full items-center justify-center shadow-lg"
          >
            <Ionicons name="locate" size={24} color="white" />
          </TouchableOpacity>
        )}

        {currentLocation && drivers.length === 0 && (
          <View className="absolute top-24 left-6 right-6 z-30">
            <View className="bg-zinc-900/90 rounded-2xl px-5 py-4 flex-row items-center border border-zinc-800 shadow-2xl backdrop-blur-md">
              <View className="bg-amber-500/10 p-2 rounded-full me-3">
                <Ionicons name="car-outline" size={20} color="#f59e0b" />
              </View>
              <Text className="text-zinc-300 text-sm font-semibold flex-1 tracking-tight">لا يوجد سائقون قريبون حالياً</Text>
            </View>
          </View>
        )}

        <View
          style={{ bottom: insets.bottom + 20 }}
          className="absolute left-4 right-4 flex-row gap-3"
        >
          <TouchableOpacity className="bg-zinc-900/90 flex-1 p-4 rounded-2xl items-center border border-zinc-800 shadow-xl">
            <Ionicons name="home" size={22} color="#10b981" />
            <Text className="text-white/80 text-xs font-bold mt-1">Home</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-zinc-900/90 flex-1 p-4 rounded-2xl items-center border border-zinc-800 shadow-xl">
            <Ionicons name="briefcase" size={22} color="#a855f7" />
            <Text className="text-white/80 text-xs font-bold mt-1">Work</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-zinc-900/90 flex-1 p-4 rounded-2xl items-center border border-zinc-800 shadow-xl">
            <Ionicons name="star" size={22} color="#f59e0b" />
            <Text className="text-white/80 text-xs font-bold mt-1">Saved</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
