import * as ExpoLocation from 'expo-location';
import { LatLng } from './map/map.provider';
import { startBackgroundLocationTask, stopBackgroundLocationTask } from './background-tasks';
import { useAuthStore } from '../stores/auth.store';
import { DEFAULT_LOCATION, DRIVER_DEFAULT_LOCATION } from '../lib/config/constants';
import { UserRole } from '../lib/api/types';

interface LocationUpdate extends LatLng {
  heading?: number;
  speed?: number;
}

class LocationService {
  private watchSubscription: ExpoLocation.LocationSubscription | null = null;

  async requestPermissions(): Promise<boolean> {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async getCurrentLocation(): Promise<LocationUpdate> {
    try {
      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading ?? undefined,
        speed: location.coords.speed ?? undefined,
      };
    } catch (error) {
      if (__DEV__) {
        console.warn('[LocationService] Failed to get real location, using mock fallback for dev:', error);
        
        const role = useAuthStore.getState().role;
        const fallback = role === UserRole.DRIVER ? DRIVER_DEFAULT_LOCATION : DEFAULT_LOCATION;

        return {
          latitude: fallback.latitude,
          longitude: fallback.longitude,
          heading: 0,
          speed: 0,
        };
      }
      throw new Error(
        `Failed to get current location: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async startTracking(
    onUpdate: (location: LocationUpdate) => void,
    intervalMs: number = 3000,
  ): Promise<void> {
    const granted = await this.requestPermissions();
    if (!granted) {
      throw new Error('Location permission not granted');
    }

    this.watchSubscription = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.Balanced,
        timeInterval: intervalMs,
        distanceInterval: 10,
      },
      (location) => {
        onUpdate({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading ?? undefined,
          speed: location.coords.speed ?? undefined,
        });
      },
    );
  }

  async stopTracking(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  async startBackgroundTracking(): Promise<void> {
    const { status } = await ExpoLocation.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Background location permission not granted');
    }
    await startBackgroundLocationTask();
  }

  async stopBackgroundTracking(): Promise<void> {
    await stopBackgroundLocationTask();
  }
}

export const locationService = new LocationService();
export type { LocationUpdate };
