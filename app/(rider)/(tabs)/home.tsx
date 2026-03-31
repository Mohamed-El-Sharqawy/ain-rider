import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RiderHome() {
  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <ScrollView className="flex-1">
        <View className="px-6 pt-8 pb-4">
          <Text className="text-zinc-400 text-sm font-medium mb-1">Welcome back,</Text>
          <Text className="text-white text-3xl font-bold leading-tight">Where are you going?</Text>
        </View>

        <View className="px-6 mt-6">
          <TouchableOpacity className="bg-zinc-900 h-20 rounded-[32px] flex-row items-center px-6 border border-zinc-800/50 shadow-2xl">
            <View className="bg-emerald-500/10 p-3 rounded-full mr-4">
              <Ionicons name="search" size={24} color="#10b981" />
            </View>
            <Text className="text-zinc-500 text-xl font-medium">Search destination...</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View className="flex-row justify-between px-6 mt-10" style={{ gap: 16 }}>
          <TouchableOpacity className="bg-zinc-900/50 flex-1 p-5 rounded-[32px] items-center border border-zinc-800/50">
            <View className="bg-emerald-500/10 p-3.5 rounded-2xl mb-3">
              <Ionicons name="home" size={26} color="#10b981" />
            </View>
            <Text className="text-white/90 font-semibold text-base">Home</Text>
          </TouchableOpacity>

          <TouchableOpacity className="bg-zinc-900/50 flex-1 p-5 rounded-[32px] items-center border border-zinc-800/50">
            <View className="bg-purple-500/10 p-3.5 rounded-2xl mb-3">
              <Ionicons name="briefcase" size={26} color="#a855f7" />
            </View>
            <Text className="text-white/90 font-semibold text-base">Work</Text>
          </TouchableOpacity>

          <TouchableOpacity className="bg-zinc-900/50 flex-1 p-5 rounded-[32px] items-center border border-zinc-800/50">
            <View className="bg-amber-500/10 p-3.5 rounded-2xl mb-3">
              <Ionicons name="star" size={26} color="#f59e0b" />
            </View>
            <Text className="text-white/90 font-semibold text-base">Saved</Text>
          </TouchableOpacity>
        </View>

        <View className="px-6 mt-10">
          <Text className="text-zinc-500 text-sm font-semibold uppercase tracking-wider mb-4">Recent Trips</Text>
          <View className="bg-zinc-900/30 rounded-3xl p-4 border border-zinc-800/30">
            <View className="flex-row items-center justify-between mb-4 border-b border-zinc-800/50 pb-4 last:border-0 last:pb-0">
              <View className="flex-row items-center">
                <View className="bg-zinc-800 p-2.5 rounded-xl mr-3">
                  <Ionicons name="location" size={20} color="#71717a" />
                </View>
                <View>
                  <Text className="text-white font-medium">Grand Central Mall</Text>
                  <Text className="text-zinc-500 text-xs mt-0.5">Downtown District</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#3f3f46" />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="bg-zinc-800 p-2.5 rounded-xl mr-3">
                  <Ionicons name="location" size={20} color="#71717a" />
                </View>
                <View>
                  <Text className="text-white font-medium">Starbucks Coffee</Text>
                  <Text className="text-zinc-500 text-xs mt-0.5">Uptown Avenue</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#3f3f46" />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
