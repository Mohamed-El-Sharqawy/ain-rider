import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="trip/[id]" options={{ headerShown: false, presentation: 'card' }} />
  </Stack>
  );
}
