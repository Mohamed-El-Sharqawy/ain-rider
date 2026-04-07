import { useEffect, useRef } from 'react';
import { Slot, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthCheck } from '../hooks/useAuthCheck';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { DriverApi } from '../lib/api/driver';
import '../global.css';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from "expo-status-bar";

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
  const { onboardingStatus, documentsStatus, fetchOnboardingStatus, vehicle: storeVehicle } = useOnboardingStore();
  const segments = useSegments();
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  console.log('[LayoutDebug] State:', { isAuthenticated, role, isOnboarding, onboardingStatus, segments, storeVehicle });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const tripId = response.notification.request.content.data?.tripId;
      if (tripId) {
        if (segmentsRef.current[0] === '(driver)') {
          router.push(`/(driver)/trip/${tripId}`);
        }
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || role !== 'DRIVER') return;
    DriverApi.updateStatus(false).catch(() => {});
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('trip-alerts', {
        name: 'Trip Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'new_trip.mp3',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#18181b',
      });
    }
  }, []);

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
        const isSharedRoute = ['support', 'offline'].includes(segments[0]);
        console.log('[LayoutDebug] Normal flow routing:', { role, inRiderGroup, inDriverGroup, isSharedRoute });

        if (role === 'RIDER' && !inRiderGroup && !isSharedRoute) {
          console.log('[LayoutDebug] Redirecting Rider -> Home');
          router.replace('/(rider)/(tabs)/home');
        } else if (role === 'DRIVER' && !inDriverGroup && !isSharedRoute) {
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
        const hasVehicleData = !!storeVehicle?.make;
        console.log('[LayoutDebug] PENDING_DOCUMENTS flow. hasVehicleData:', hasVehicleData);

        if (!hasVehicleData) {
          if (currentAuthStep !== 'vehicle-info') {
            console.log('[LayoutDebug] No vehicle data -> Redirecting to vehicle-info');
            router.replace('/(auth)/vehicle-info');
          }
        } else {
          console.log('[LayoutDebug] Has vehicle data -> Defaulting to document upload');
          if (currentAuthStep !== 'driver-documents' && currentAuthStep !== 'vehicle-info') {
            router.replace('/(auth)/driver-documents');
          }
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
      <StatusBar style="light" />
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
