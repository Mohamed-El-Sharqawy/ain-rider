import { useState, useEffect, useRef } from 'react';
import { MatchApi } from '../lib/api/match.api';

export interface NearbyDriver {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
}

/**
 * Hook for polling nearby drivers around a coordinate.
 * Polls every 10 seconds to keep map updated without overwhelming the server.
 */
export function useNearbyDrivers(latitude?: number, longitude?: number, enabled: boolean = true) {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchNearby = async () => {
    if (!latitude || !longitude) return;
    try {
      const data = await MatchApi.getNearbyDrivers(latitude, longitude);
      setDrivers(data);
    } catch (error) {
      console.error('Failed to fetch nearby drivers:', error);
    }
  };

  useEffect(() => {
    if (!enabled || !latitude || !longitude) {
      setDrivers([]);
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      return;
    }

    // Initial fetch
    fetchNearby();

    // Setup polling
    pollInterval.current = setInterval(fetchNearby, 10000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [latitude, longitude, enabled]);

  return drivers;
}
