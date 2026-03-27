import { View, Text } from 'react-native';

export default function DriverHome() {
  return (
    <View className="flex-1 items-center justify-center bg-zinc-50">
      <Text className="text-3xl font-extrabold text-zinc-900">Driver Dashboard</Text>
      <Text className="text-lg text-zinc-500 mt-2">Finding nearby trips...</Text>
    </View>
  );
}
