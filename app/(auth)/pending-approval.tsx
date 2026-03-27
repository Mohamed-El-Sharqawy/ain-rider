import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function PendingApprovalScreen() {
  return (
    <View className="flex-1 bg-zinc-900 justify-center items-center px-10">
      <Text className="text-8xl mb-10">⏳</Text>
      <Text className="text-4xl font-extrabold text-white mb-6 text-center leading-tight">Application Received</Text>
      
      <Text className="text-center text-zinc-400 text-lg mb-12 leading-relaxed font-medium">
        We're reviewing your profile and vehicle details. This process usually takes 24-48 hours. We'll notify you once you're approved to hit the road!
      </Text>

      <View className="w-full bg-zinc-800 rounded-3xl p-8 mb-16 border border-zinc-700 shadow-xl">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-zinc-400 font-semibold text-lg">Status</Text>
          <View className="bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/40">
            <Text className="text-amber-400 font-bold tracking-wider">IN REVIEW</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-zinc-400 font-semibold text-lg">Est. Completion</Text>
          <Text className="text-white font-medium text-lg">Tomorrow</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        className="bg-indigo-500 py-4 px-10 rounded-xl items-center active:opacity-80 w-full shadow-lg"
        onPress={() => router.replace('/(auth)/welcome')}
      >
        <Text className="text-white text-xl font-bold">Return to Start</Text>
      </TouchableOpacity>
    </View>
  );
}
