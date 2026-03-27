import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role-selection" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="basic-info" />
      <Stack.Screen name="vehicle-info" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="pending-approval" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
