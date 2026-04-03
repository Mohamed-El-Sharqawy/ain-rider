import { useEffect } from 'react';
import { Slot, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthCheck } from '../hooks/useAuthCheck';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
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
  const { onboardingStatus, documentsStatus, fetchOnboardingStatus } = useOnboardingStore();
  const segments = useSegments();

  console.log('[LayoutDebug] State:', { isAuthenticated, role, isOnboarding, onboardingStatus, segments });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && role === 'DRIVER' && (isOnboarding || onboardingStatus === null)) {
      fetchOnboardingStatus();
    }
  }, [isAuthenticated, role, isOnboarding, onboardingStatus]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isOffline = segments[0] === 'offline';

    // Hide splash screen explicitly before evaluating the complex routing
    // early returns below caused the hide async hook at the end to be missed.
    SplashScreen.hideAsync();

    if (isOffline) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && role && !isOnboarding) {
      // If it's a DRIVER, we must WAIT for the onboardingStatus if it's not yet known (to prevent jumping straight to home)
      if (role === 'DRIVER' && onboardingStatus === null) {
        console.log('[LayoutDebug] Skipping routing: waiting for driver status...');
        return;
      }

      // If driver is NOT approved after fetch, treat it as onboarding even if flag was missing
      if (role === 'DRIVER' && onboardingStatus && onboardingStatus !== 'APPROVED') {
        console.log('[LayoutDebug] Onboarding required based on status:', onboardingStatus);
        // Let the next branch handle it
      } else {
        const inRiderGroup = segments[0] === '(rider)';
        const inDriverGroup = segments[0] === '(driver)';
        console.log('[LayoutDebug] Normal flow routing:', { role, inRiderGroup, inDriverGroup });

        if (role === 'RIDER' && !inRiderGroup) {
          console.log('[LayoutDebug] Redirecting Rider -> Home');
          router.replace('/(rider)/(tabs)/home');
        } else if (role === 'DRIVER' && !inDriverGroup) {
          console.log('[LayoutDebug] Redirecting Driver -> Home');
          router.replace('/(driver)/(tabs)/home');
        }
        return; // Early return to avoid going into next branch
      }
    }

    if (isAuthenticated && role === 'DRIVER' && (isOnboarding || (onboardingStatus && onboardingStatus !== 'APPROVED'))) {
      console.log('[LayoutDebug] Onboarding flow routing. documentsStatus:', documentsStatus);
      // Smart redirection for rejected drivers
      const allSegments = segments as string[];
      const currentAuthStep = allSegments[allSegments.length - 1];

      if (documentsStatus?.identity.status === 'REJECTED') {
        console.log('[LayoutDebug] Identity rejected -> driver-documents');
        if (currentAuthStep !== 'driver-documents') {
          router.replace('/(auth)/driver-documents');
        }
      } else if (documentsStatus?.drivingLicense.status === 'REJECTED') {
        console.log('[LayoutDebug] License rejected -> driver-documents');
        if (currentAuthStep !== 'driver-documents') {
          router.replace('/(auth)/driver-documents');
        }
      } else if (documentsStatus?.vehicle.status === 'REJECTED') {
        console.log('[LayoutDebug] Vehicle rejected -> vehicle-info');
        if (currentAuthStep !== 'vehicle-info') {
          router.replace('/(auth)/vehicle-info');
        }
      } else if (onboardingStatus === 'UNDER_REVIEW') {
        console.log('[LayoutDebug] Under review -> pending-approval');
        if (currentAuthStep !== 'pending-approval') {
          router.replace('/(auth)/pending-approval');
        }
      } else if (onboardingStatus === 'PENDING_DOCUMENTS') {
        console.log('[LayoutDebug] Defaulting to document upload');
        // Based on documentsStatus, we can be more smart, but driver-documents is the unified hub
        if (currentAuthStep !== 'driver-documents' && currentAuthStep !== 'vehicle-info') {
          router.replace('/(auth)/driver-documents');
        }
      } else {
        console.log('[LayoutDebug] No specific redirection. Current path:', currentAuthStep);
      }
    } else {
      console.log('[LayoutDebug] No routing condition matched');
    }
  }, [isAuthenticated, isReady, role, isOnboarding, segments, onboardingStatus, documentsStatus]);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Slot />
      {/* {__DEV__ && (
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
      )} */}
    </SafeAreaProvider>
  );
}
