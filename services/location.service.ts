import * as ExpoLocation from 'expo-location';
import { LatLng } from './map/map.provider';
import { startBackgroundLocationTask, stopBackgroundLocationTask } from './background-tasks';

interface LocationUpdate extends LatLng {
  heading?: number;
  speed?: number;
}

// const BAGHDAD = { latitude: 30.147719, longitude: 31.394327 };
const BAGHDAD = { latitude: 30.147719, longitude: 31.394327 };

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
      console.warn('[LocationService] Failed to get real location, using fallback:', error);
      return {
        ...BAGHDAD,
        heading: 0,
        speed: 0,
      };
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
