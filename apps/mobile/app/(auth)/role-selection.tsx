import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRole } from '../../lib/api/types';

export default function RoleSelectionScreen() {
  const { setRole } = useOnboardingStore();

  const handleRoleSelect = async (role: UserRole.RIDER | UserRole.DRIVER) => {
    setRole(role);
    await SecureStore.setItemAsync('pendingRole', role);
    router.push('/(auth)/phone');
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <View className="px-6 pt-16">
        <Text className="text-white text-5xl font-extrabold tracking-tighter">I want to...</Text>
        <Text className="text-zinc-500 text-xl mt-3 font-medium leading-relaxed">Choose how you'd like to use the app</Text>

        <View className="mt-12">
          <TouchableOpacity 
            className="bg-zinc-900 border border-zinc-800/50 p-10 rounded-[40px] mb-6 shadow-sm active:bg-zinc-800/80 active:scale-[0.98] transition-all"
            onPress={() => handleRoleSelect(UserRole.RIDER)}
          >
            <View className="bg-emerald-600/10 w-20 h-20 rounded-[32px] items-center justify-center mb-8">
              <Ionicons name="person" size={40} color="#10b981" />
            </View>
            <Text className="text-4xl font-extrabold text-white mb-2 tracking-tight">Book Rides</Text>
            <Text className="text-xl text-zinc-500 font-medium leading-relaxed">Reach your destination with safe and reliable journeys.</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="bg-zinc-900 border border-zinc-800/50 p-10 rounded-[40px] shadow-sm active:bg-zinc-800/80 active:scale-[0.98] transition-all"
            onPress={() => handleRoleSelect(UserRole.DRIVER)}
          >
            <View className="bg-purple-600/10 w-20 h-20 rounded-[32px] items-center justify-center mb-8">
              <Ionicons name="car" size={40} color="#a855f7" />
            </View>
            <Text className="text-4xl font-extrabold text-white mb-2 tracking-tight">Earn Money</Text>
            <Text className="text-xl text-zinc-500 font-medium leading-relaxed">Join our driver community and earn on your schedule.</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          className="mt-10 items-center py-4"
          onPress={() => router.push('/(auth)/login')}
        >
           <Text className="text-zinc-500 text-lg">Already have an account? <Text className="text-white font-bold">Log In</Text></Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
