import { useEffect, useRef } from 'react';
import { api } from '@/api/client';

const REFRESH_INTERVAL = 14 * 60 * 1000;

export function useTokenRefresh() {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        await api.post('/auth/refresh');
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    };

    intervalRef.current = window.setInterval(refreshToken, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
