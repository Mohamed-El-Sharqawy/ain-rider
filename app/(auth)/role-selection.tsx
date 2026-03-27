import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import * as SecureStore from 'expo-secure-store';

export default function RoleSelectionScreen() {
  const { setRole } = useOnboardingStore();

  const handleRoleSelect = async (role: 'RIDER' | 'DRIVER') => {
    setRole(role);
    await SecureStore.setItemAsync('pendingRole', role);
    router.push('/(auth)/phone');
  };

  return (
    <View className="flex-1 bg-zinc-900 px-6 pt-24">
      <Text className="text-4xl font-extrabold text-white mb-2">Choose your path</Text>
      <Text className="text-xl text-zinc-400 mb-10">How would you like to use Ain Rider?</Text>

      <TouchableOpacity 
        className="bg-zinc-800 border border-zinc-700 p-8 rounded-3xl mb-6 shadow-sm active:bg-zinc-700"
        onPress={() => handleRoleSelect('RIDER')}
      >
        <Text className="text-3xl font-extrabold text-emerald-400 mb-2">Rider</Text>
        <Text className="text-lg text-zinc-400">I want to book rides and get around efficiently.</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-zinc-800 border border-zinc-700 p-8 rounded-3xl shadow-sm active:bg-zinc-700"
        onPress={() => handleRoleSelect('DRIVER')}
      >
        <Text className="text-3xl font-extrabold text-indigo-400 mb-2">Driver</Text>
        <Text className="text-lg text-zinc-400">I want to drive passengers and earn money.</Text>
      </TouchableOpacity>
    </View>
  );
}
