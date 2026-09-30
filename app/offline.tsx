import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineScreen() {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected && state.isInternetReachable) {
        router.replace('/');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-zinc-900 px-8">
      <Text className="text-5xl mb-6">📶</Text>
      <Text className="text-3xl font-extrabold text-white mb-4">You're Offline</Text>
      <Text className="text-center text-zinc-400 text-lg mb-10 leading-relaxed">
        We can't reach the servers to refresh your session. Connect to the internet and try again.
      </Text>
      
      <TouchableOpacity 
        className="bg-white py-4 px-8 rounded-full items-center active:opacity-80 w-full max-w-xs shadow-lg flex-row justify-center"
        onPress={handleRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <ActivityIndicator color="#18181b" size="small" />
        ) : (
          <Text className="text-zinc-900 text-lg font-bold">Retry Connection</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
