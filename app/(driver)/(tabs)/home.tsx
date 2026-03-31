import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { DriverApi } from '../../../lib/api/driver';
import { useAuthStore } from '../../../stores/auth.store';
import { Ionicons } from '@expo/vector-icons';

export default function DriverHome() {
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<any>(null);
  const { logout } = useAuthStore();

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await DriverApi.getOnboardingStatus();
      setOnboardingStatus(res.data);
      // Backend should confirm if approved, but updateStatus will fail if not approved anyway
    } catch (error) {
      console.error('Failed to fetch onboarding status', error);
    }
  };

  const toggleStatus = async () => {
    setIsLoading(true);
    try {
      const res = await DriverApi.updateStatus(!isOnline);
      if (res.success) {
        setIsOnline(!isOnline);
      }
    } catch (error: any) {
      Alert.alert('Status Error', error.message || 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  const statusLabel = isOnline ? 'ONLINE' : 'OFFLINE';
  const statusColor = isOnline ? 'bg-emerald-500' : 'bg-zinc-800';

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="bg-zinc-900 pt-16 pb-6 px-6 border-b border-zinc-800 flex-row justify-between items-center">
        <View>
          <Text className="text-zinc-500 text-xs font-black uppercase tracking-widest">Status</Text>
          <View className="flex-row items-center mt-1">
            <View className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            <Text className="text-white font-bold text-lg">{statusLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} className="p-2">
           <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-10">
        <View className="w-full bg-zinc-900 p-8 rounded-[40px] border border-zinc-800 items-center">
          <Text className="text-zinc-500 text-sm font-bold text-center mb-10">
            {isOnline ? 'You are visible to riders' : 'Go online to receive trip requests'}
          </Text>

          <TouchableOpacity 
            onPress={toggleStatus}
            disabled={isLoading}
            className={`w-32 h-32 rounded-full items-center justify-center border-8 ${isOnline ? 'bg-emerald-500/10 border-emerald-500' : 'bg-zinc-950 border-zinc-800'} shadow-xl`}
          >
            {isLoading ? (
              <ActivityIndicator color={isOnline ? '#10b981' : '#52525b'} size="large" />
            ) : (
              <Ionicons name="power" size={48} color={isOnline ? '#10b981' : '#3f3f46'} />
            )}
          </TouchableOpacity>

          <Text className={`mt-8 font-black text-xl tracking-[4px] ${isOnline ? 'text-emerald-500' : 'text-zinc-700'}`}>
            {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
          </Text>
        </View>
      </View>

      {/* Stats bar */}
      <View className="flex-row bg-zinc-900 border-t border-zinc-800 py-6">
        <View className="flex-1 border-r border-zinc-800 items-center">
          <Text className="text-zinc-500 text-xs font-bold mb-1">TRIPS</Text>
          <Text className="text-white font-black text-xl">0</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-zinc-500 text-xs font-bold mb-1">EARNINGS</Text>
          <Text className="text-white font-black text-xl">$0.00</Text>
        </View>
      </View>
    </View>
  );
}
