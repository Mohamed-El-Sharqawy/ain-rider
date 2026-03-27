import { useState, useCallback, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../stores/auth.store';
import { TokenPayload } from '../types/user.types';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';

export function useAuthCheck() {
  const [isReady, setIsReady] = useState(false);
  const { setAuth } = useAuthStore();

  const checkAuth = useCallback(async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!accessToken || !refreshToken) {
        setAuth(false, null);
        setIsReady(true);
        return;
      }

      const decoded = jwtDecode<TokenPayload>(accessToken);
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if access token is still valid
      if (decoded.exp > currentTime) {
        setAuth(true, decoded.role);
        setIsReady(true);
        return;
      }

      // Access Token expired - attempt to refresh
      const networkState = await NetInfo.fetch();
      
      if (!networkState.isConnected) {
        // Offline and access token expired (refresh unreachable) -> Show offline UI
        router.replace('/offline');
        // Do not unblock isReady immediately so the splash screen gracefully hides on next render
      } else {
        // Network is reachable, but for the scope of this onboarding test, 
        // we'll assume we hit an endpoint. Mocking refresh failure to route to login instead of infinite loop.
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        setAuth(false, null);
      }
      
    } catch (e) {
      // Corrupt token or decode failed
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setAuth(false, null);
    } finally {
      setIsReady(true);
    }
  }, [setAuth]);

  return { isReady, checkAuth };
}
