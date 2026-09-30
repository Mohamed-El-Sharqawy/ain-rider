import { Stack } from 'expo-router';

export default function RiderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="search" options={{ headerShown: false, presentation: 'card' }} />
    <Stack.Screen name="pick-location" options={{ headerShown: false, presentation: 'card' }} />
    <Stack.Screen name="confirm" options={{ headerShown: false, presentation: 'card' }} />
    <Stack.Screen name="trip/[id]" options={{ headerShown: false, presentation: 'modal' }} />
    <Stack.Screen name="trip/rate" options={{ headerShown: false, presentation: 'card' }} />
  </Stack>
  );
}
