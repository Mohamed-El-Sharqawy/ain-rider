import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  // Acts as a placeholder while the RootLayout executes the Auth Check
  return (
    <View className="flex-1 bg-zinc-950 items-center justify-center">
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}
