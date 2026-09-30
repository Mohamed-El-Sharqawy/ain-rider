import { View, Text, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../../stores/trip.store';
import { mapProvider } from '../../services/map';
import { useLocation } from '../../hooks/useLocation';

type ActiveField = 'pickup' | 'dropoff';

export default function SearchScreen() {
  const router = useRouter();
  const tripStore = useTripStore();
  const { currentLocation } = useLocation();

  const [activeField, setActiveField] = useState<ActiveField>('dropoff');
  const [pickupQuery, setPickupQuery] = useState(
    tripStore.selectedPickup?.address || '',
  );
  const [dropoffQuery, setDropoffQuery] = useState(
    tripStore.selectedDropoff?.address || '',
  );
  const [pickupSet, setPickupSet] = useState(!!tripStore.selectedPickup);
  const [dropoffSet, setDropoffSet] = useState(!!tripStore.selectedDropoff);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const pickupRef = useRef<TextInput>(null);
  const dropoffRef = useRef<TextInput>(null);
  const initialMount = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  // Re-sync from store when screen regains focus (e.g. returning from pick-location)
  useFocusEffect(
    useCallback(() => {
      const storePickup = useTripStore.getState().selectedPickup;
      const storeDropoff = useTripStore.getState().selectedDropoff;
      if (storePickup) {
        setPickupQuery(storePickup.address);
        setPickupSet(true);
      }
      if (storeDropoff) {
        setDropoffQuery(storeDropoff.address);
        setDropoffSet(true);
      }
    }, []),
  );

  // Default pickup to current location if not set
  useEffect(() => {
    if (!pickupSet && currentLocation) {
      tripStore.setPickup({
        location: currentLocation,
        address: 'Current Location',
      });
      setPickupQuery('Current Location');
      setPickupSet(true);
    }
  }, [currentLocation]);

  // Auto-focus dropoff on mount
  useEffect(() => {
    setTimeout(() => dropoffRef.current?.focus(), 100);
  }, []);

  // Debounced search
  const activeQuery = activeField === 'pickup' ? pickupQuery : dropoffQuery;

  useEffect(() => {
    if (activeField === 'pickup' && pickupSet) return;
    if (activeField === 'dropoff' && dropoffSet) return;

    const q = activeQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoading(true);
      try {
        const data = await mapProvider.searchPlaces(q, currentLocation || undefined);
        if (!controller.signal.aborted) {
          setResults(data);
        }
      } catch {
        // ignore
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, [activeQuery, activeField, pickupSet, dropoffSet]);

  // Navigate to confirm when both are set (skip initial mount)
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (pickupSet && dropoffSet) {
      router.push('/(rider)/confirm');
    }
  }, [pickupSet, dropoffSet]);

  const selectPlace = useCallback(
    (place: any) => {
      Keyboard.dismiss();
      const loc = { latitude: place.latitude, longitude: place.longitude };
      const name = place.displayName;

      if (activeField === 'pickup') {
        tripStore.setPickup({ location: loc, address: name });
        setPickupQuery(name);
        setPickupSet(true);
        setResults([]);
        // Move focus to dropoff if not set
        if (!dropoffSet) {
          setActiveField('dropoff');
          setTimeout(() => dropoffRef.current?.focus(), 100);
        }
      } else {
        tripStore.setDropoff({ location: loc, address: name });
        setDropoffQuery(name);
        setDropoffSet(true);
        setResults([]);
      }
    },
    [activeField, dropoffSet, tripStore],
  );

  const useCurrentLocation = useCallback(() => {
    if (!currentLocation) return;
    Keyboard.dismiss();
    tripStore.setPickup({ location: currentLocation, address: 'Current Location' });
    setPickupQuery('Current Location');
    setPickupSet(true);
    setResults([]);
    if (!dropoffSet) {
      setActiveField('dropoff');
      setTimeout(() => dropoffRef.current?.focus(), 100);
    }
  }, [currentLocation, dropoffSet, tripStore]);

  const chooseOnMap = useCallback(() => {
    Keyboard.dismiss();
    router.push(`/(rider)/pick-location?field=${activeField}`);
  }, [activeField, router]);

  const handleSwap = useCallback(() => {
    const prevPickup = tripStore.selectedPickup;
    const prevDropoff = tripStore.selectedDropoff;
    if (prevPickup) {
      tripStore.setDropoff(prevPickup);
      setDropoffQuery(prevPickup.address);
      setDropoffSet(true);
    } else {
      tripStore.setDropoff(null as any);
      setDropoffQuery('');
      setDropoffSet(false);
    }
    if (prevDropoff) {
      tripStore.setPickup(prevDropoff);
      setPickupQuery(prevDropoff.address);
      setPickupSet(true);
    } else {
      tripStore.setPickup(null as any);
      setPickupQuery('');
      setPickupSet(false);
    }
  }, [tripStore]);

  const clearField = useCallback(
    (field: ActiveField) => {
      if (field === 'pickup') {
        setPickupQuery('');
        setPickupSet(false);
        tripStore.setPickup(null as any);
        setActiveField('pickup');
        setTimeout(() => pickupRef.current?.focus(), 100);
      } else {
        setDropoffQuery('');
        setDropoffSet(false);
        tripStore.setDropoff(null as any);
        setActiveField('dropoff');
        setTimeout(() => dropoffRef.current?.focus(), 100);
      }
      setResults([]);
    },
    [tripStore],
  );

  const handlePickupFocus = () => {
    setActiveField('pickup');
    if (pickupSet) {
      // User taps on an already-set field — clear it to re-search
      setPickupSet(false);
      setResults([]);
    }
  };

  const handleDropoffFocus = () => {
    setActiveField('dropoff');
    if (dropoffSet) {
      setDropoffSet(false);
      setResults([]);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg ms-2">Plan your trip</Text>
      </View>

      {/* Input fields */}
      <View className="px-4 pb-2">
        <View className="flex-row items-center">
          {/* Route dots + line */}
          <View className="items-center me-3 py-1">
            <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <View className="w-0.5 flex-1 bg-zinc-700 my-1" />
            <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </View>

          {/* Inputs */}
          <View className="flex-1">
            {/* Pickup */}
            <View
              className={`bg-zinc-900 rounded-xl px-3 py-2.5 mb-2 flex-row items-center border ${
                activeField === 'pickup' ? 'border-emerald-500/50' : 'border-zinc-800'
              }`}
            >
              <TextInput
                ref={pickupRef}
                placeholder="Pickup location"
                value={pickupQuery}
                onChangeText={(t) => {
                  setPickupQuery(t);
                  setPickupSet(false);
                }}
                onFocus={handlePickupFocus}
                className="text-white flex-1 text-sm"
                placeholderTextColor="#71717a"
              />
              {pickupQuery.length > 0 && (
                <TouchableOpacity onPress={() => clearField('pickup')} className="p-1">
                  <Ionicons name="close-circle" size={18} color="#71717a" />
                </TouchableOpacity>
              )}
            </View>

            {/* Dropoff */}
            <View
              className={`bg-zinc-900 rounded-xl px-3 py-2.5 flex-row items-center border ${
                activeField === 'dropoff' ? 'border-red-500/50' : 'border-zinc-800'
              }`}
            >
              <TextInput
                ref={dropoffRef}
                placeholder="Where to?"
                value={dropoffQuery}
                onChangeText={(t) => {
                  setDropoffQuery(t);
                  setDropoffSet(false);
                }}
                onFocus={handleDropoffFocus}
                className="text-white flex-1 text-sm"
                placeholderTextColor="#71717a"
              />
              {dropoffQuery.length > 0 && (
                <TouchableOpacity onPress={() => clearField('dropoff')} className="p-1">
                  <Ionicons name="close-circle" size={18} color="#71717a" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Swap button */}
          <TouchableOpacity onPress={handleSwap} className="ms-3 bg-zinc-800 p-2 rounded-full">
            <Ionicons name="swap-vertical" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick actions */}
      <View className="px-4 pb-2">
        {activeField === 'pickup' && currentLocation && (
          <TouchableOpacity
            onPress={useCurrentLocation}
            className="flex-row items-center bg-zinc-900 rounded-xl px-4 py-3 mb-2 border border-zinc-800"
          >
            <Ionicons name="locate" size={18} color="#10b981" />
            <Text className="text-emerald-400 text-sm font-medium ms-2">Use my current location</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={chooseOnMap}
          className="flex-row items-center bg-zinc-900 rounded-xl px-4 py-3 mb-2 border border-zinc-800"
        >
          <Ionicons name="map" size={18} color="#3b82f6" />
          <Text className="text-blue-400 text-sm font-medium ms-2">Choose on map</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        {loading && <Text className="text-zinc-500 text-center py-4">Searching...</Text>}
        {results.map((place) => (
          <TouchableOpacity
            key={place.placeId}
            onPress={() => selectPlace(place)}
            className="bg-zinc-900 rounded-xl px-4 py-3 mb-2 border border-zinc-800"
          >
            <View className="flex-row items-center">
              <Ionicons name="location" size={18} color="#a1a1aa" />
              <View className="ms-2 flex-1">
                <Text className="text-white text-sm" numberOfLines={2}>
                  {place.displayName}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
