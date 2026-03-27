import { useEffect } from 'react';
import { Slot, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthCheck } from '../hooks/useAuthCheck';
import { useAuthStore } from '../stores/auth.store';
import '../global.css';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Suppress excessive Reanimated Strict Mode warnings caused by NativeWind v4 transitions
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isReady, checkAuth } = useAuthCheck();
  const { isAuthenticated, role } = useAuthStore();
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
    } else if (isAuthenticated && role) {
      if (role === 'RIDER') {
        router.replace('/(rider)/(tabs)/home');
      } else if (role === 'DRIVER') {
        router.replace('/(driver)/(tabs)/home');
      }
    }

    // Hide the splash screen after the navigation state is resolved
    SplashScreen.hideAsync();
  }, [isAuthenticated, isReady, role, segments]);

  if (!isReady) {
    return null;
  }

  return <Slot />;
}
