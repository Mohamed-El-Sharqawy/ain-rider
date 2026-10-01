import { locationService } from '../../services/location.service';
import { useAuthStore } from '../../stores/auth.store';
import { UserRole } from '../../lib/api/types';
import { DEFAULT_LOCATION, DRIVER_DEFAULT_LOCATION } from '../../lib/config/constants';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('../../services/background-tasks', () => ({
  startBackgroundLocationTask: jest.fn(),
  stopBackgroundLocationTask: jest.fn(),
}));

const ExpoLocation = require('expo-location');
const {
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
} = require('../../services/background-tasks');

const coords = (over: Partial<GeolocationCoordinates>) => ({
  latitude: 30.0444,
  longitude: 31.2357,
  heading: null,
  speed: null,
  ...over,
});

describe('locationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setAuth(false, null);
  });

  describe('requestPermissions', () => {
    it.each([
      ['granted', true],
      ['denied', false],
    ] as const)('returns %s status as %s', async (status, expected) => {
      ExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status });

      await expect(locationService.requestPermissions()).resolves.toBe(expected);
    });
  });

  describe('getCurrentLocation', () => {
    it('returns the device coordinates', async () => {
      ExpoLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: coords({ latitude: 30.1, longitude: 31.2, heading: 90, speed: 12.5 }),
      });

      await expect(locationService.getCurrentLocation()).resolves.toEqual({
        latitude: 30.1,
        longitude: 31.2,
        heading: 90,
        speed: 12.5,
      });
    });

    it('maps null heading and speed to undefined', async () => {
      ExpoLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: coords({}),
      });

      await expect(locationService.getCurrentLocation()).resolves.toEqual({
        latitude: 30.0444,
        longitude: 31.2357,
        heading: undefined,
        speed: undefined,
      });
    });

    describe('in development, when the position cannot be read', () => {
      beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation();
      });
      afterEach(() => {
        (console.warn as jest.Mock).mockRestore();
      });

      it('falls back to the default rider location', async () => {
        ExpoLocation.getCurrentPositionAsync.mockRejectedValue(new Error('provider unavailable'));

        await expect(locationService.getCurrentLocation()).resolves.toEqual({
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          heading: 0,
          speed: 0,
        });
      });

      it('falls back to the default driver location for drivers', async () => {
        useAuthStore.getState().setAuth(true, UserRole.DRIVER);
        ExpoLocation.getCurrentPositionAsync.mockRejectedValue(new Error('provider unavailable'));

        await expect(locationService.getCurrentLocation()).resolves.toEqual({
          latitude: DRIVER_DEFAULT_LOCATION.latitude,
          longitude: DRIVER_DEFAULT_LOCATION.longitude,
          heading: 0,
          speed: 0,
        });
      });
    });

    describe('in production', () => {
      beforeEach(() => {
        (global as { __DEV__?: boolean }).__DEV__ = false;
      });
      afterEach(() => {
        (global as { __DEV__?: boolean }).__DEV__ = true;
      });

      it('rethrows Error failures with context', async () => {
        ExpoLocation.getCurrentPositionAsync.mockRejectedValue(new Error('provider unavailable'));

        await expect(locationService.getCurrentLocation()).rejects.toThrow(
          'Failed to get current location: provider unavailable',
        );
      });

      it('stringifies non-Error failures', async () => {
        ExpoLocation.getCurrentPositionAsync.mockRejectedValue('boom');

        await expect(locationService.getCurrentLocation()).rejects.toThrow(
          'Failed to get current location: boom',
        );
      });
    });
  });

  describe('startTracking', () => {
    it('throws when foreground permission is not granted', async () => {
      ExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      await expect(locationService.startTracking(jest.fn())).rejects.toThrow(
        'Location permission not granted',
      );
      expect(ExpoLocation.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('forwards mapped fixes to the onUpdate callback', async () => {
      ExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      let watcher: (loc: { coords: ReturnType<typeof coords> }) => void = () => {};
      const subscription = { remove: jest.fn() };
      ExpoLocation.watchPositionAsync.mockImplementation(
        (_options: unknown, cb: (loc: { coords: ReturnType<typeof coords> }) => void) => {
          watcher = cb;
          return Promise.resolve(subscription);
        },
      );

      const onUpdate = jest.fn();
      await locationService.startTracking(onUpdate, 5000);

      expect(ExpoLocation.watchPositionAsync).toHaveBeenCalledWith(
        { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        expect.any(Function),
      );

      watcher({ coords: coords({ latitude: 30.5, longitude: 31.5, heading: 45, speed: 8 }) });
      expect(onUpdate).toHaveBeenCalledWith({
        latitude: 30.5,
        longitude: 31.5,
        heading: 45,
        speed: 8,
      });

      watcher({ coords: coords({ latitude: 30.6, longitude: 31.6 }) });
      expect(onUpdate).toHaveBeenLastCalledWith({
        latitude: 30.6,
        longitude: 31.6,
        heading: undefined,
        speed: undefined,
      });
    });

    it('stops the active watch on stopTracking', async () => {
      ExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
      const subscription = { remove: jest.fn() };
      ExpoLocation.watchPositionAsync.mockResolvedValue(subscription);

      await locationService.startTracking(jest.fn());
      await locationService.stopTracking();

      expect(subscription.remove).toHaveBeenCalledTimes(1);
      // A second stop is a no-op
      await locationService.stopTracking();
      expect(subscription.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('background tracking', () => {
    it('throws when background permission is not granted', async () => {
      ExpoLocation.requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

      await expect(locationService.startBackgroundTracking()).rejects.toThrow(
        'Background location permission not granted',
      );
      expect(startBackgroundLocationTask).not.toHaveBeenCalled();
    });

    it('starts the background task when permission is granted', async () => {
      ExpoLocation.requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

      await locationService.startBackgroundTracking();

      expect(startBackgroundLocationTask).toHaveBeenCalledTimes(1);
    });

    it('stops the background task', async () => {
      await locationService.stopBackgroundTracking();

      expect(stopBackgroundLocationTask).toHaveBeenCalledTimes(1);
    });
  });
});
