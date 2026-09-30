import { LocationApi } from '../../lib/api/location.api';
import { ApiClient } from '../../lib/api/client';
import { wsService } from '../../services/websocket.service';

type TaskExecutor = (payload: { data?: unknown; error?: Error }) => Promise<void>;
let taskExecutor: TaskExecutor | null = null;

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn((_name: string, executor: TaskExecutor) => {
    taskExecutor = executor;
  }),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

jest.mock('../../lib/api/location.api', () => ({
  LocationApi: { updateDriverLocation: jest.fn() },
}));

jest.mock('../../lib/api/client', () => ({
  ApiClient: { refreshToken: jest.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('../../services/websocket.service', () => ({
  wsService: {
    isConnected: jest.fn(),
    getCurrentUrl: jest.fn(),
    reconnect: jest.fn(),
  },
}));

const ExpoLocation = require('expo-location');

// Load the module under test once; the defineTask mock captures its executor.
require('../../services/background-tasks');
const runTask = (data?: unknown, error?: Error) => taskExecutor!({ data, error });

const locationData = (coords: Record<string, number | null>) => ({
  locations: [{ coords }],
});

describe('background location task', () => {
  const { AppState } = require('react-native');

  beforeEach(() => {
    jest.clearAllMocks();
    AppState.currentState = 'background';
  });

  it('registers the task with TaskManager', () => {
    expect(taskExecutor).toBeInstanceOf(Function);
  });

  it('exits silently when the task errors', async () => {
    await runTask(undefined, new Error('task error'));
    expect(LocationApi.updateDriverLocation).not.toHaveBeenCalled();
  });

  it('exits silently when no data is provided', async () => {
    await runTask(undefined);
    expect(LocationApi.updateDriverLocation).not.toHaveBeenCalled();
  });

  it('skips reporting while the app is in the foreground', async () => {
    AppState.currentState = 'active';

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 5, speed: 10 }));

    expect(LocationApi.updateDriverLocation).not.toHaveBeenCalled();
  });

  it('exits silently when the fix contains no locations', async () => {
    await runTask({ locations: [] });
    expect(LocationApi.updateDriverLocation).not.toHaveBeenCalled();
  });

  it('reports the newest fix with optional fields normalized', async () => {
    (LocationApi.updateDriverLocation as jest.Mock).mockResolvedValue({});
    (wsService.isConnected as jest.Mock).mockReturnValue(true);

    await runTask(
      locationData({ latitude: 30, longitude: 31, heading: null, speed: null }),
    );

    expect(LocationApi.updateDriverLocation).toHaveBeenCalledWith({
      latitude: 30,
      longitude: 31,
      heading: undefined,
      speed: undefined,
    });
  });

  it('reports heading and speed when present', async () => {
    (LocationApi.updateDriverLocation as jest.Mock).mockResolvedValue({});
    (wsService.isConnected as jest.Mock).mockReturnValue(true);

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 12, speed: 34 }));

    expect(LocationApi.updateDriverLocation).toHaveBeenCalledWith({
      latitude: 30,
      longitude: 31,
      heading: 12,
      speed: 34,
    });
  });

  it('retries once after refreshing the token on a 401', async () => {
    const { ApiError } = require('../../lib/api/client');
    const authError = new ApiError(401, 'Unauthorized');
    (LocationApi.updateDriverLocation as jest.Mock)
      .mockRejectedValueOnce(authError)
      .mockResolvedValue({});
    (ApiClient.refreshToken as jest.Mock).mockResolvedValue('new-token');
    (wsService.isConnected as jest.Mock).mockReturnValue(true);

    // Null optional fields exercise the retry payload's normalization branch
    await runTask(locationData({ latitude: 30, longitude: 31, heading: null, speed: null }));

    expect(LocationApi.updateDriverLocation).toHaveBeenCalledTimes(2);
    expect(LocationApi.updateDriverLocation).toHaveBeenLastCalledWith({
      latitude: 30,
      longitude: 31,
      heading: undefined,
      speed: undefined,
    });
    expect(ExpoLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('stops updates when the refresh yields no token', async () => {
    const { ApiError } = require('../../lib/api/client');
    (LocationApi.updateDriverLocation as jest.Mock).mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    (ApiClient.refreshToken as jest.Mock).mockResolvedValue(null);

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 1, speed: 2 }));

    expect(ExpoLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith('DRIVER_LOCATION_UPDATE');
  });

  it('stops updates when the retry after refresh still fails', async () => {
    const { ApiError } = require('../../lib/api/client');
    const warnSpy = jest.spyOn(console, 'error').mockImplementation();
    (LocationApi.updateDriverLocation as jest.Mock).mockRejectedValue(
      new ApiError(401, 'Unauthorized'),
    );
    (ApiClient.refreshToken as jest.Mock).mockResolvedValue('new-token');
    // First call rejects with 401, retry also rejects with 401
    (LocationApi.updateDriverLocation as jest.Mock)
      .mockRejectedValueOnce(new ApiError(401, 'Unauthorized'))
      .mockRejectedValue(new ApiError(401, 'still unauthorized'));

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 1, speed: 2 }));

    expect(LocationApi.updateDriverLocation).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalled();
    expect(ExpoLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith('DRIVER_LOCATION_UPDATE');
    warnSpy.mockRestore();
  });

  it('logs and continues on non-auth failures', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    (LocationApi.updateDriverLocation as jest.Mock).mockRejectedValue(
      new Error('server unavailable'),
    );
    (wsService.isConnected as jest.Mock).mockReturnValue(true);

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 1, speed: 2 }));

    expect(warnSpy).toHaveBeenCalledWith(
      '[BackgroundTask] Failed to update location:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('reconnects the websocket when it dropped', async () => {
    (LocationApi.updateDriverLocation as jest.Mock).mockResolvedValue({});
    (wsService.isConnected as jest.Mock).mockReturnValue(false);
    (wsService.getCurrentUrl as jest.Mock).mockReturnValue('ws://localhost:3001/ws');

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 1, speed: 2 }));

    expect(wsService.reconnect).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect when no url is known', async () => {
    (LocationApi.updateDriverLocation as jest.Mock).mockResolvedValue({});
    (wsService.isConnected as jest.Mock).mockReturnValue(false);
    (wsService.getCurrentUrl as jest.Mock).mockReturnValue(null);

    await runTask(locationData({ latitude: 30, longitude: 31, heading: 1, speed: 2 }));

    expect(wsService.reconnect).not.toHaveBeenCalled();
  });
});

describe('startBackgroundLocationTask', () => {
  const { startBackgroundLocationTask } = require('../../services/background-tasks');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when updates are already running', async () => {
    ExpoLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);

    await startBackgroundLocationTask();

    expect(ExpoLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('starts balanced updates with a foreground service notification', async () => {
    ExpoLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false);

    await startBackgroundLocationTask();

    expect(ExpoLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(
      'DRIVER_LOCATION_UPDATE',
      expect.objectContaining({
        accuracy: ExpoLocation.Accuracy.Balanced,
        foregroundService: {
          notificationTitle: 'Ain Rider',
          notificationBody: 'Tracking your location for trip matching',
        },
      }),
    );
  });
});

describe('stopBackgroundLocationTask', () => {
  const { stopBackgroundLocationTask } = require('../../services/background-tasks');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when updates are not running', async () => {
    ExpoLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false);

    await stopBackgroundLocationTask();

    expect(ExpoLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('stops updates when they are running', async () => {
    ExpoLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);

    await stopBackgroundLocationTask();

    expect(ExpoLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith('DRIVER_LOCATION_UPDATE');
  });
});
