import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../../../stores/trip.store';
import { TripApi } from '../../../lib/api/trip.api';

export default function RateScreen() {
  const router = useRouter();
  const tripStore = useTripStore();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const activeTrip = tripStore.activeTrip;

  const handleSubmit = async () => {
    if (rating === 0 || !activeTrip) return;
    setSubmitting(true);
    try {
      await TripApi.rateTrip(activeTrip.tripId, rating, 'rider');
      tripStore.reset();
      router.replace('/(rider)/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold mb-2">Rate your driver</Text>
        <Text className="text-zinc-500 text-sm mb-8">How was your trip?</Text>

        <View className="flex-row mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              className="p-2"
              testID={`rate-star-${star}`}
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={48}
                color={star <= rating ? '#f59e0b' : '#3f3f46'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          className={`w-full py-4 rounded-xl items-center ${rating === 0 ? 'bg-zinc-800' : 'bg-emerald-500'}`}
        >
          <Text className={`font-bold text-lg text-center ${rating === 0 ? 'text-zinc-500' : 'text-white'}`}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
