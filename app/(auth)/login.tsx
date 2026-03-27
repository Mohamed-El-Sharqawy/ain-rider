import { View, Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../stores/auth.store';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  return (
    <View className="flex-1 items-center justify-center bg-zinc-900">
      <Text className="text-4xl font-extrabold text-white mb-2">Ain Rider</Text>
      <Text className="text-lg text-zinc-400 mb-12">Your ride, your way.</Text>
      
      <View className="w-full max-w-sm px-8">
        <TouchableOpacity 
          className="bg-emerald-500 py-4 rounded-xl items-center active:opacity-80 shadow-lg"
          onPress={() => setAuth(true, 'RIDER')}
        >
          <Text className="text-white text-lg font-bold">Login as Rider</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-indigo-500 py-4 rounded-xl items-center active:opacity-80 shadow-lg mt-4"
          onPress={() => setAuth(true, 'DRIVER')}
        >
          <Text className="text-white text-lg font-bold">Login as Driver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
