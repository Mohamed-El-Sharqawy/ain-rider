import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { LocationApi } from '../lib/api/location.api';
import { ApiClient, ApiError } from '../lib/api/client';
import { wsService } from './websocket.service';

const TASK_NAME = 'DRIVER_LOCATION_UPDATE';

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    return;
  }

  if (!data) {
    return;
  }

  if (AppState.currentState === 'active') {
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const location = locations[locations.length - 1];

  if (!location) {
    return;
  }

  const { latitude, longitude, heading, speed } = location.coords;

  try {
    await LocationApi.updateDriverLocation({
      latitude,
      longitude,
      heading: heading ?? undefined,
      speed: speed ?? undefined,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      console.warn('[BackgroundTask] Auth expired, attempting token refresh...');
      
      // Attempt token refresh before stopping
      const newToken = await ApiClient.refreshToken();
      
      if (newToken) {
        try {
          await LocationApi.updateDriverLocation({
            latitude,
            longitude,
            heading: heading ?? undefined,
            speed: speed ?? undefined,
          });
          return;
        } catch (retryErr) {
          console.error('[BackgroundTask] Location update failed after refresh:', retryErr);
        }
      }
      
      // Only stop if refresh failed
      await Location.stopLocationUpdatesAsync(TASK_NAME);
      return;
    }
    console.warn('[BackgroundTask] Failed to update location:', err);
  }

  if (!wsService.isConnected()) {
    const url = wsService.getCurrentUrl();
    if (url) {
      wsService.reconnect();
    }
  }
});

export async function startBackgroundLocationTask(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (isRunning) {
    return;
  }

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Ain Rider',
      notificationBody: 'Tracking your location for trip matching',
    },
  });
}

export async function stopBackgroundLocationTask(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (!isRunning) {
    return;
  }

  await Location.stopLocationUpdatesAsync(TASK_NAME);
}
