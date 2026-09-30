import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const availableServices = [
  { id: 'car', name: 'Car Ride', description: 'Book a comfortable car ride', icon: 'car-sport', color: '#10b981', href: "/home" },
];

const comingSoonServices = [
  { id: 'motorcycle', name: 'Motorcycle', icon: 'bicycle' },
  { id: 'package', name: 'Package', icon: 'cube' },
  { id: 'food', name: 'Food Delivery', icon: 'restaurant' },
  { id: 'bus', name: 'Bus', icon: 'bus' },
  { id: 'truck', name: 'Moving', icon: 'truck' },
];

export default function ServicesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-6 pt-6 mb-8">
          <Text className="text-3xl font-bold text-white tracking-tight">Services</Text>
          <Text className="text-zinc-500 mt-1">Choose your ride</Text>
        </View>

        {/* Available Services */}
        <View className="px-6 mb-8">
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">Available Now</Text>
          <View className="gap-4">
            {availableServices.map((service) => (
              <TouchableOpacity
                key={service.id}
                className="bg-zinc-900 rounded-3xl p-6 flex-row items-center border border-zinc-800/50"
                activeOpacity={0.7}
                onPress={() => router.push(service.href)}
              >
                <View
                  className="w-16 h-16 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: `${service.color}20` }}
                >
                  <Ionicons name={service.icon as any} color={service.color} size={32} />
                </View>
                <View className="flex-1 ms-4">
                  <Text className="text-xl font-bold text-white">{service.name}</Text>
                  <Text className="text-zinc-500 text-sm mt-1">{service.description}</Text>
                </View>
                <Ionicons name="chevron-forward" color="#3f3f46" size={24} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Coming Soon */}
        <View className="px-6">
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">Coming Soon</Text>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {comingSoonServices.map((service) => (
              <View
                key={service.id}
                style={{ width: '48%' }}
                className="bg-zinc-900/50 rounded-2xl p-5 items-center border flex-grow border-zinc-800/30"
              >
                <View className="relative">
                  <Ionicons name={service.icon as any} color="#52525b" size={28} />
                </View>
                <Text className="text-zinc-500 font-medium mt-3">{service.name}</Text>
                <View className="bg-zinc-800 px-3 py-1 rounded-full mt-2">
                  <Text className="text-zinc-400 text-xs font-semibold">Soon</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
