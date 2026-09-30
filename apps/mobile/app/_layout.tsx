import { useEffect, useRef, useCallback } from 'react';
import { Slot, router, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, Linking, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthCheck } from '../hooks/useAuthCheck';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { DriverApi } from '../lib/api/driver';
import { AuthApi } from '../lib/api/auth';
import { clearResponseCache } from '../lib/api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../global.css';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from '../components/common/ErrorBoundary';

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

SplashScreen.preventAutoHideAsync();

const lastRedirect = { path: '', ts: 0 };

function safeReplace(path: string) {
  const now = Date.now();
  if (lastRedirect.path === path && now - lastRedirect.ts < 500) return;
  lastRedirect.path = path;
  lastRedirect.ts = now;
  router.replace(path as any);
}

const DEEP_LINK_STORAGE_KEY = 'pending_deep_link';

type LayoutPhase = 'INITIALIZING' | 'AUTH_CHECKING' | 'UNAUTHENTICATED' | 'AUTHENTICATED' | 'ONBOARDING' | 'READY';

export default function RootLayout() {
  const { isReady, checkAuth } = useAuthCheck();
  const { isAuthenticated, role, isOnboarding } = useAuthStore();
  const { onboardingStatus, documentsStatus, fetchOnboardingStatus, vehicle: storeVehicle } = useOnboardingStore();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const phaseRef = useRef<LayoutPhase>('INITIALIZING');
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const mountedRef = useRef(true);
  const pendingDeepLinkProcessed = useRef(false);

  const resolvePhase = useCallback((): LayoutPhase => {
    if (!isReady) return 'INITIALIZING';
    if (!isAuthenticated) return 'UNAUTHENTICATED';
    if (role === 'DRIVER' && (isOnboarding || (onboardingStatus !== null && onboardingStatus !== 'APPROVED'))) return 'ONBOARDING';
    if (role === 'DRIVER' && onboardingStatus === null) return 'AUTH_CHECKING';
    return 'READY';
  }, [isReady, isAuthenticated, role, isOnboarding, onboardingStatus]);

  // --- INIT: one-time setup effects (auth check, notification channels, global listeners) ---
  useEffect(() => {
    checkAuth();

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('trip-alerts', {
        name: 'Trip Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'notification.wav',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#18181b',
      });
    }

    if (Platform.OS === 'ios') {
      Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      }).catch(() => {});
    }

    const notificationSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const tripId = response.notification.request.content.data?.tripId;
      if (tripId && segmentsRef.current[0] === '(driver)') {
        router.push(`/(driver)/trip/${tripId}`);
      }
    });

    const appStateRef = { current: AppState.currentState };
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        clearResponseCache();
      }
      appStateRef.current = nextState;
    });

    return () => {
      notificationSub.remove();
      appStateSub.remove();
    };
  }, [checkAuth]);

  // --- AUTH EFFECTS: deep links, driver offline, onboarding fetch ---
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (!isAuthenticated) {
        await AsyncStorage.setItem(DEEP_LINK_STORAGE_KEY, url);
        return;
      }
      const path = url.replace(/^ain-rider:\/\//, '');
      if (path) router.push(path as any);
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    if (isAuthenticated && isReady && !pendingDeepLinkProcessed.current) {
      (async () => {
        const stored = await AsyncStorage.getItem(DEEP_LINK_STORAGE_KEY);
        if (stored) {
          await AsyncStorage.removeItem(DEEP_LINK_STORAGE_KEY);
          pendingDeepLinkProcessed.current = true;
          const path = stored.replace(/^ain-rider:\/\//, '');
          if (path) router.push(path as any);
        }
      })();
    }

    if (isAuthenticated && role === 'DRIVER') {
      (async () => {
        try {
          const me = await AuthApi.getMe();
          if ((me as any).isOnline) return;
        } catch {}
        if (mountedRef.current) DriverApi.updateStatus(false).catch(() => {});
      })();

      if (isOnboarding || onboardingStatus === null) {
        fetchOnboardingStatus();
      }
    }

    return () => { linkingSub.remove(); };
  }, [isAuthenticated, isReady, role, isOnboarding, onboardingStatus, fetchOnboardingStatus]);

  // --- ROUTING: state-machine driven navigation ---
  useEffect(() => {
    const phase = resolvePhase();
    phaseRef.current = phase;

    if (phase === 'INITIALIZING' || !navigationState?.key) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const isOffline = segments[0] === 'offline';
    if (isOffline) return;

    if (phase === 'UNAUTHENTICATED') {
      if (!inAuthGroup) safeReplace('/(auth)/welcome');
      return;
    }

    if (phase === 'AUTH_CHECKING') return;

    if (phase === 'ONBOARDING' && role === 'DRIVER') {
      const allSegments = segments as string[];
      const currentAuthStep = allSegments[allSegments.length - 1];

      if (documentsStatus?.identity.status === 'REJECTED') {
        if (currentAuthStep !== 'driver-documents') safeReplace('/(auth)/driver-documents');
      } else if (documentsStatus?.drivingLicense.status === 'REJECTED') {
        if (currentAuthStep !== 'driver-documents') safeReplace('/(auth)/driver-documents');
      } else if (documentsStatus?.vehicle.status === 'REJECTED') {
        if (currentAuthStep !== 'vehicle-info') safeReplace('/(auth)/vehicle-info');
      } else if (onboardingStatus === 'UNDER_REVIEW') {
        if (currentAuthStep !== 'pending-approval') safeReplace('/(auth)/pending-approval');
      } else if (onboardingStatus === 'PENDING_DOCUMENTS') {
        const hasVehicleData = !!storeVehicle?.make;
        if (!hasVehicleData) {
          if (currentAuthStep !== 'vehicle-info') safeReplace('/(auth)/vehicle-info');
        } else {
          if (currentAuthStep !== 'driver-documents' && currentAuthStep !== 'vehicle-info') {
            safeReplace('/(auth)/driver-documents');
          }
        }
      }
      return;
    }

    if (phase === 'READY') {
      const inRiderGroup = segments[0] === '(rider)';
      const inDriverGroup = segments[0] === '(driver)';
      const isSharedRoute = ['support', 'offline'].includes(segments[0]);

      if (role === 'RIDER' && !inRiderGroup && !isSharedRoute) {
        safeReplace('/(rider)/(tabs)/home');
      } else if (role === 'DRIVER' && !inDriverGroup && !isSharedRoute) {
        safeReplace('/(driver)/(tabs)/home');
      }
    }
  }, [isReady, isAuthenticated, role, isOnboarding, onboardingStatus, documentsStatus, segments, storeVehicle, resolvePhase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  if (!isReady || !navigationState?.key) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Slot />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
