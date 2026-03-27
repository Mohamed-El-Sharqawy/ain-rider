import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function OfflineScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-zinc-900 px-8">
      <Text className="text-5xl mb-6">📶</Text>
      <Text className="text-3xl font-extrabold text-white mb-4">You're Offline</Text>
      <Text className="text-center text-zinc-400 text-lg mb-10 leading-relaxed">
        We can't reach the servers to refresh your session. Connect to the internet and try again.
      </Text>
      
      <TouchableOpacity 
        className="bg-white py-4 px-8 rounded-full items-center active:opacity-80 w-full max-w-xs shadow-lg"
        onPress={() => router.replace('/')}
      >
        <Text className="text-zinc-900 text-lg font-bold">Retry Connection</Text>
      </TouchableOpacity>
    </View>
  );
}
