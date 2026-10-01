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
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    };

    intervalRef.current = window.setInterval(refreshToken, REFRESH_INTERVAL);

    return () => {
      // the interval is always set above before the cleanup can run
      clearInterval(intervalRef.current!);
    };
  }, []);
}
