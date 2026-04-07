import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TripApi } from '../../../lib/api/trip.api';
import { TripResponse } from '../../../lib/api/types';

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatFare(fare: number): string {
  return fare.toLocaleString() + ' IQD';
}

function formatDistance(km: number | undefined): string {
  if (km == null) return '';
  return `${km} km`;
}

function formatDuration(min: number | undefined): string {
  if (min == null) return '';
  return `${min} min`;
}

export default function ActivityScreen() {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await TripApi.getMyTrips();
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setError('Failed to load trips');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      {/* Header */}
      <View className="px-6 pt-6 pb-2 flex-row justify-between items-end">
        <View>
          <Text className="text-3xl font-bold text-white tracking-tight">Activity</Text>
          <Text className="text-zinc-500 mt-1">Your ride history</Text>
        </View>
        <TouchableOpacity className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800/50">
          <Ionicons name="options-outline" color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 mt-4"
        contentContainerStyle={{ paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="mt-20 items-center">
            <ActivityIndicator color="#10b981" size="large" />
            <Text className="text-zinc-500 mt-4">Loading your rides...</Text>
          </View>
        ) : error ? (
          <View className="mt-12 items-center px-10">
            <View className="bg-zinc-900/50 w-32 h-32 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
              <Ionicons name="alert-circle" color="#3f3f46" size={64} />
            </View>
            <Text className="text-2xl font-bold text-white mb-3 text-center">Something went wrong</Text>
            <Text className="text-zinc-500 text-center leading-6 mb-8">
              We couldn't load your trips. Please try again.
            </Text>
            <TouchableOpacity onPress={loadTrips} className="bg-emerald-600 px-8 py-4 rounded-2xl">
              <Text className="text-white font-bold text-lg">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : trips.length === 0 ? (
          <View className="mt-12 items-center px-10">
            <View className="bg-zinc-900/50 w-32 h-32 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
              <Ionicons name="car-sport" color="#3f3f46" size={64} />
            </View>
            <Text className="text-2xl font-bold text-white mb-3 text-center">Ready for a ride?</Text>
            <Text className="text-zinc-500 text-center leading-6 mb-8">
              Your recent trips will appear here. Book your first ride and experience the difference.
            </Text>
            <TouchableOpacity className="bg-emerald-600 px-8 py-4 rounded-2xl">
              <Text className="text-white font-bold text-lg">Book a Ride</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-5 pb-10">
            {trips.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                className="bg-zinc-900/60 rounded-[32px] overflow-hidden border border-zinc-800/50"
                activeOpacity={0.85}
              >
                <View className="p-6">
                  {/* Top Row: Date & Status */}
                  <View className="flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center">
                      <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full mr-2">
                        <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                          Completed
                        </Text>
                      </View>
                      <Text className="text-zinc-500 text-xs font-medium">
                        {formatDate(trip.requestedAt)}
                      </Text>
                    </View>
                    <Text className="text-lg font-bold text-white tracking-tight">
                      {formatFare(trip.actualFare ?? trip.estimatedFare)}
                    </Text>
                  </View>

                  {/* Route Details */}
                  <View className="flex-row gap-4 mb-6">
                    <View className="items-center py-1">
                      <View className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-zinc-950" />
                      <View className="w-[1.5px] h-10 bg-zinc-800 my-1" />
                      <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </View>
                    <View className="flex-1 gap-4">
                      <View>
                        <Text className="text-zinc-500 text-[10px] items-center text-left font-bold uppercase tracking-[2px] mb-1">Pickup</Text>
                        <Text className="text-white/90 text-[15px] font-semibold" numberOfLines={1}>{trip.pickupAddress}</Text>
                      </View>
                      <View>
                        <Text className="text-zinc-500 text-[10px] items-center text-left font-bold uppercase tracking-[2px] mb-1">Destination</Text>
                        <Text className="text-white/90 text-[15px] font-semibold" numberOfLines={1}>{trip.dropoffAddress}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Footer: Driver & Stats */}
                  {trip.driverName && (
                    <View className="pt-5 border-t border-zinc-800/50 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="w-10 h-10 rounded-full border border-zinc-800 mr-3 bg-zinc-800 items-center justify-center">
                          <Ionicons name="person" color="#71717a" size={20} />
                        </View>
                        <View>
                          <Text className="text-white font-bold text-sm">{trip.driverName}</Text>
                          <View className="flex-row items-center border-none">
                            {trip.driverRating != null && (
                              <>
                                <Ionicons name="star" color="#fbbf24" size={12} />
                                <Text className="text-zinc-500 text-xs ml-1">{trip.driverRating}</Text>
                                <Text className="text-zinc-700 mx-1.5">•</Text>
                              </>
                            )}
                            {trip.distance != null && (
                              <Text className="text-zinc-500 text-xs">{formatDistance(trip.distance)}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity className="bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-700/30 active:bg-zinc-700">
                        <Ionicons name="repeat" color="#a1a1aa" size={18} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
