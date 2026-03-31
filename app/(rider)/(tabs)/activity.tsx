import { View, Text, ScrollView, TouchableOpacity, Image, Pressable } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const recentTrips = [
  {
    id: '1',
    date: 'Today, 2:30 PM',
    from: 'Al-Mansour, Baghdad',
    to: 'Karrada, Baghdad',
    fare: '15,000 IQD',
    status: 'completed',
    driver: {
      name: 'Ahmed K.',
      rating: 4.9,
      avatar: 'https://i.pravatar.cc/100?u=ahmed',
    },
    distance: '8.4 km',
    duration: '22 min',
  },
  {
    id: '2',
    date: 'Yesterday, 5:45 PM',
    from: 'Sadr City, Baghdad',
    to: 'Al-Kadhimiya, Baghdad',
    fare: '22,000 IQD',
    status: 'completed',
    driver: {
      name: 'Mustafa R.',
      rating: 4.8,
      avatar: 'https://i.pravatar.cc/100?u=mustafa',
    },
    distance: '15.2 km',
    duration: '45 min',
  },
  {
    id: '3',
    date: 'Mar 27, 10:15 AM',
    from: 'Al-Jadriya, Baghdad',
    to: 'Al-Zawra Park, Baghdad',
    fare: '8,500 IQD',
    status: 'completed',
    driver: {
      name: 'Sara M.',
      rating: 5.0,
      avatar: 'https://i.pravatar.cc/100?u=sara',
    },
    distance: '4.1 km',
    duration: '12 min',
  },
];

export default function ActivityScreen() {
  const [activeTab, setActiveTab] = useState<'rides' | 'transactions'>('rides');

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      {/* Header */}
      <View className="px-6 pt-6 pb-2 flex-row justify-between items-end">
        <View>
          <Text className="text-3xl font-bold text-white tracking-tight">Activity</Text>
          <Text className="text-zinc-500 mt-1">Your ride history & wallet</Text>
        </View>
        <TouchableOpacity className="bg-zinc-900 p-3 rounded-2xl border border-zinc-800/50">
          <Ionicons name="options-outline" color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {/* Custom Tab Switcher */}
      <View className="px-6 mt-6">
        <View className="bg-zinc-900/80 p-1.5 rounded-[24px] flex-row border border-zinc-800/50">
          <TouchableOpacity
            onPress={() => setActiveTab('rides')}
            activeOpacity={0.7}
            className={`flex-1 py-3 items-center rounded-[20px] ${activeTab === 'rides' ? 'bg-emerald-600' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'rides' ? 'text-white' : 'text-zinc-500'}`}>Rides</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('transactions')}
            activeOpacity={0.7}
            className={`flex-1 py-3 items-center rounded-[20px] ${activeTab === 'transactions' ? 'bg-emerald-600' : ''}`}
          >
            <Text className={`font-bold ${activeTab === 'transactions' ? 'text-white' : 'text-zinc-500'}`}>Transactions</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 mt-4"
        contentContainerStyle={{ paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'rides' ? (
          recentTrips.length === 0 ? (
            <View className="mt-12 items-center px-10">
              <View className="bg-zinc-900/50 w-32 h-32 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
                <Ionicons name="car-sport" color="#3f3f46" size={64} />
              </View>
              <Text className="text-2xl font-bold text-white mb-3 text-center">Ready for a ride?</Text>
              <Text className="text-zinc-500 text-center leading-6 mb-8">
                Your recent trips will appear here. Book your first ride and experience the difference.
              </Text>
              <TouchableOpacity className="bg-emerald-600 px-8 py-4 rounded-2xl">
                <Text className="text-white font-bold text-lg">Book a Ride</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-5">
              {recentTrips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  className="bg-zinc-900/60 rounded-[32px] overflow-hidden border border-zinc-800/50"
                  activeOpacity={0.85}
                >
                  <View className="p-6">
                    {/* Top Row: Date & Status */}
                    <View className="flex-row justify-between items-center mb-6">
                      <View className="flex-row items-center">
                        <View className="bg-emerald-500/20 px-3 py-1.5 rounded-full mr-2">
                          <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Completed</Text>
                        </View>
                        <Text className="text-zinc-500 text-xs font-medium">{trip.date}</Text>
                      </View>
                      <Text className="text-lg font-bold text-white tracking-tight">{trip.fare}</Text>
                    </View>

                    {/* Route Details */}
                    <View className="flex-row gap-4 mb-6">
                      <View className="items-center py-1">
                        <View className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-zinc-950" />
                        <View className="w-[1.5px] h-10 bg-zinc-800 my-1" />
                        <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </View>
                      <View className="flex-1 gap-4">
                        <View>
                          <Text className="text-zinc-500 text-[10px] items-center text-left font-bold uppercase tracking-[2px] mb-1">Pickup</Text>
                          <Text className="text-white/90 text-[15px] font-semibold" numberOfLines={1}>{trip.from}</Text>
                        </View>
                        <View>
                          <Text className="text-zinc-500 text-[10px] items-center text-left font-bold uppercase tracking-[2px] mb-1">Destination</Text>
                          <Text className="text-white/90 text-[15px] font-semibold" numberOfLines={1}>{trip.to}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Footer: Driver & Stats */}
                    <View className="pt-5 border-t border-zinc-800/50 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <Image source={{ uri: trip.driver.avatar }} className="w-10 h-10 rounded-full border border-zinc-800 mr-3" />
                        <View>
                          <Text className="text-white font-bold text-sm">{trip.driver.name}</Text>
                          <View className="flex-row items-center border-none">
                            <Ionicons name="star" color="#fbbf24" size={12} />
                            <Text className="text-zinc-500 text-xs ml-1">{trip.driver.rating}</Text>
                            <Text className="text-zinc-700 mx-1.5">•</Text>
                            <Text className="text-zinc-500 text-xs">{trip.distance}</Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity className="bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-700/30 active:bg-zinc-700">
                        <Ionicons name="repeat" color="#a1a1aa" size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : (
          /* Transactions View Mock */
          <View className="gap-4">
            {[1, 2, 3].map((i) => (
              <View key={i} className="bg-zinc-900/60 p-5 rounded-[24px] border border-zinc-800/50 flex-row items-center">
                <View className="w-12 h-12 rounded-2xl bg-zinc-800/80 items-center justify-center mr-4">
                  <Ionicons name={i === 2 ? "arrow-down" : "car"} color={i === 2 ? "#fb7185" : "#10b981"} size={22} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">{i === 2 ? 'Wallet Top-up' : 'Ride Payment'}</Text>
                  <Text className="text-zinc-500 text-xs mt-0.5">Mar {28 - i}, 4:30 PM</Text>
                </View>
                <Text className={`font-bold text-base ${i === 2 ? 'text-zinc-400' : 'text-white'}`}>
                  {i === 2 ? '+50,000' : '-12,000'} IQD
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
