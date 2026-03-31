import { useEffect } from 'react';
import { Slot, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthCheck } from '../hooks/useAuthCheck';
import { useAuthStore } from '../stores/auth.store';
import '../global.css';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { Pressable, Text } from 'react-native';
import { SecureStorage } from '../lib/storage/secure';

import { SafeAreaProvider } from 'react-native-safe-area-context';

// Suppress excessive Reanimated Strict Mode warnings caused by NativeWind v4 transitions
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isReady, checkAuth } = useAuthCheck();
  const { isAuthenticated, role, isOnboarding } = useAuthStore();
  const segments = useSegments();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOffline = segments[0] === 'offline';

    if (isOffline) {
      SplashScreen.hideAsync();
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && role && !isOnboarding) {
      const inRiderGroup = segments[0] === '(rider)';
      const inDriverGroup = segments[0] === '(driver)';

      if (role === 'RIDER' && !inRiderGroup) {
        router.replace('/(rider)/(tabs)/home');
      } else if (role === 'DRIVER' && !inDriverGroup) {
        router.replace('/(driver)/(tabs)/home');
      }
    }

    // Hide the splash screen after the navigation state is resolved
    SplashScreen.hideAsync();
  }, [isAuthenticated, isReady, role, isOnboarding, segments]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Slot />
      {__DEV__ && (
        <Pressable
          onPress={async () => {
            console.log('Resetting auth...');
            await SecureStorage.clearTokens();
            router.replace('/(auth)/welcome');
          }}
          style={{ position: 'absolute', top: 50, right: 16, zIndex: 999 }}
        >
          <Text style={{ fontSize: 11, color: 'red' }}>Reset auth</Text>
        </Pressable>
      )}
    </SafeAreaProvider>
  );
}
