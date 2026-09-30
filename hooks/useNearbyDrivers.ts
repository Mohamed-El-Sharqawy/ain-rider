import { useState, useEffect, useRef } from 'react';
import { MatchApi } from '../lib/api/match.api';

export interface NearbyDriver {
  id: string;
  lat: number;
  lng: number;
  heading?: number;
}

interface UseNearbyDriversOptions {
  enabled?: boolean;
  pollingIntervalMs?: number;
}

export function useNearbyDrivers(
  latitude?: number,
  longitude?: number,
  enabledOrOptions: boolean | UseNearbyDriversOptions = true,
) {
  const options = typeof enabledOrOptions === 'boolean'
    ? { enabled: enabledOrOptions, pollingIntervalMs: 10000 }
    : { enabled: enabledOrOptions.enabled ?? true, pollingIntervalMs: enabledOrOptions.pollingIntervalMs ?? 10000 };

  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchNearby = async () => {
    if (!latitude || !longitude) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await MatchApi.getNearbyDrivers(latitude, longitude);
      setDrivers(data);
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch nearby drivers';
      console.error(message, err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!options.enabled || !latitude || !longitude) {
      setDrivers([]);
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      return;
    }

    fetchNearby();

    pollInterval.current = setInterval(fetchNearby, options.pollingIntervalMs);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [latitude, longitude, options.enabled, options.pollingIntervalMs]);

  return { drivers, isLoading, error };
}
