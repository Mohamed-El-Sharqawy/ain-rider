import { wsService } from '../../services/websocket.service';
import { SecureStorage } from '../../lib/storage/secure';

const OPEN = 1;
const CONNECTING = 0;

const mockAppStateListeners: Array<(state: string) => void> = [];

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(
      (_type: string, cb: (state: string) => void) => {
        mockAppStateListeners.push(cb);
        return {
          remove: () => {
            const index = mockAppStateListeners.indexOf(cb);
            if (index >= 0) mockAppStateListeners.splice(index, 1);
          },
        };
      },
    ),
  },
}));

jest.mock('reconnecting-websocket', () => {
  class ReconnectingWebSocket {
    static instances: ReconnectingWebSocket[] = [];
    url: string;
    readyState = 0;
    onmessage: ((event: { data: string }) => void) | null = null;
    onopen: (() => void) | null = null;
    onclose: ((event: { code: number; reason?: string }) => void) | null = null;
    send = jest.fn();
    close = jest.fn();
    reconnect = jest.fn();
    constructor(url: string) {
      this.url = url;
      ReconnectingWebSocket.instances.push(this);
    }
  }
  return ReconnectingWebSocket;
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidNotificationPriority: { HIGH: 4 },
}));

jest.mock('../../lib/storage/secure', () => ({
  SecureStorage: {
    saveTokens: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

const ReconnectingWebSocket = require('reconnecting-websocket');
const Notifications = require('expo-notifications');

// Captured at module load, before jest.clearAllMocks() wipes the call history.
const notificationBehavior =
  Notifications.setNotificationHandler.mock.calls[0][0].handleNotification;

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64');
const futureToken = `h.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.s`;
const expiredToken = `h.${b64({ exp: Math.floor(Date.now() / 1000) - 3600 })}.s`;

const WS_URL = 'ws://localhost:3001/ws';

const currentSocket = () =>
  ReconnectingWebSocket.instances[ReconnectingWebSocket.instances.length - 1];

const openSocket = () => {
  const socket = currentSocket();
  socket.readyState = OPEN;
  return socket;
};

const deliverMessage = (socket: { onmessage: ((e: { data: string }) => void) | null }, payload: unknown) => {
  socket.onmessage!({ data: JSON.stringify(payload) });
};

describe('wsService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    ReconnectingWebSocket.instances.length = 0;
    mockAppStateListeners.length = 0;
    (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(null);
    wsService.disconnect();
  });

  afterEach(() => {
    wsService.disconnect();
    jest.useRealTimers();
  });

  describe('notification handler', () => {
    it('presents incoming notifications with an alert, sound and no badge', async () => {
      await expect(notificationBehavior()).resolves.toEqual({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      });
    });
  });

  describe('connect', () => {
    it('appends a valid stored token to the url as a query parameter', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(futureToken);

      await wsService.connect(WS_URL);

      expect(currentSocket().url).toBe(`${WS_URL}?token=${encodeURIComponent(futureToken)}`);
      expect(wsService.getCurrentUrl()).toBe(WS_URL);
    });

    it('connects without a token when none is stored', async () => {
      await wsService.connect(WS_URL);

      expect(currentSocket().url).toBe(WS_URL);
    });

    it('connects without a token when the stored token is expired', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(expiredToken);

      await wsService.connect(WS_URL);

      expect(currentSocket().url).toBe(WS_URL);
    });

    it('extends an existing query string instead of adding a second one', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(futureToken);

      await wsService.connect(`${WS_URL}?client=mobile`);

      expect(currentSocket().url).toBe(`${WS_URL}?client=mobile&token=${encodeURIComponent(futureToken)}`);
    });

    it('is a no-op when the socket is already open', async () => {
      await wsService.connect(WS_URL);
      openSocket();
      const socketCount = ReconnectingWebSocket.instances.length;

      await wsService.connect(WS_URL);

      expect(ReconnectingWebSocket.instances).toHaveLength(socketCount);
    });

    it('creates a fresh socket when the previous one is still connecting', async () => {
      await wsService.connect(WS_URL);
      currentSocket().readyState = CONNECTING;

      await wsService.connect(WS_URL);

      expect(ReconnectingWebSocket.instances).toHaveLength(2);
    });
  });

  describe('connection state', () => {
    it('reports connected only while the socket is open', async () => {
      await wsService.connect(WS_URL);
      expect(wsService.isConnected()).toBe(false);

      openSocket();
      expect(wsService.isConnected()).toBe(true);
    });
  });

  describe('reconnect', () => {
    it('asks the live socket to reconnect when one exists', async () => {
      await wsService.connect(WS_URL);

      await wsService.reconnect();

      expect(currentSocket().reconnect).toHaveBeenCalledTimes(1);
    });

    it('does nothing after a disconnect', async () => {
      await wsService.connect(WS_URL);
      wsService.disconnect();

      await wsService.reconnect();

      expect(ReconnectingWebSocket.instances).toHaveLength(1);
      expect(currentSocket().reconnect).not.toHaveBeenCalled();
    });

    it('re-establishes a connection from the remembered url when the socket was never created', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockRejectedValueOnce(
        new Error('storage locked'),
      );
      await expect(wsService.connect(WS_URL)).rejects.toThrow('storage locked');
      expect(ReconnectingWebSocket.instances).toHaveLength(0);

      await wsService.reconnect();

      expect(ReconnectingWebSocket.instances).toHaveLength(1);
      expect(currentSocket().url).toBe(WS_URL);
    });
  });

  describe('waitForConnection', () => {
    it('resolves immediately when the socket is already open', async () => {
      await wsService.connect(WS_URL);
      openSocket();

      await expect(wsService.waitForConnection()).resolves.toBeUndefined();
    });

    it('resolves once the socket opens', async () => {
      await wsService.connect(WS_URL);
      const pending = wsService.waitForConnection();

      await currentSocket().onopen!();
      await expect(pending).resolves.toBeUndefined();
    });

    it('rejects after the timeout elapses', async () => {
      await wsService.connect(WS_URL);
      const pending = wsService.waitForConnection(1000);

      jest.advanceTimersByTime(1500);

      await expect(pending).rejects.toThrow('WebSocket connection timeout');
    });
  });

  describe('onopen', () => {
    it('authenticates with the freshly stored token and starts the heartbeat', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(futureToken);
      await wsService.connect(WS_URL);
      const socket = openSocket();

      await socket.onopen!();

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'auth', token: futureToken }),
      );
      socket.send.mockClear();

      jest.advanceTimersByTime(25000);

      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });

    it('skips authentication when no fresh token exists', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();

      await socket.onopen!();

      expect(socket.send).not.toHaveBeenCalledWith(
        expect.stringContaining('"auth"'),
      );
    });
  });

  describe('onmessage', () => {
    it('answers protocol pings with a pong while open', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();

      deliverMessage(socket, { type: 'ping' });

      const sent = socket.send.mock.calls.map(([payload]: string[]) => JSON.parse(payload));
      expect(sent).toContainEqual({ type: 'pong', timestamp: expect.any(Number) });
    });

    it('ignores protocol pings while not open', async () => {
      await wsService.connect(WS_URL);
      const socket = currentSocket();

      deliverMessage(socket, { type: 'ping' });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it('dispatches typed messages to registered handlers', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();
      const handler = jest.fn();
      wsService.on('trip_updated', handler);

      deliverMessage(socket, { type: 'trip_updated', data: { status: 'ARRIVED' } });

      expect(handler).toHaveBeenCalledWith({ status: 'ARRIVED' });
    });

    it('stops dispatching after off', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();
      const handler = jest.fn();
      wsService.on('trip_updated', handler);
      wsService.off('trip_updated', handler);

      deliverMessage(socket, { type: 'trip_updated', data: {} });

      expect(handler).not.toHaveBeenCalled();
    });

    it('unsubscribes via the dispose function returned by on', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();
      const handler = jest.fn();
      const dispose = wsService.on('trip_updated', handler);
      dispose();

      deliverMessage(socket, { type: 'trip_updated', data: {} });

      expect(handler).not.toHaveBeenCalled();
    });

    it('dispatches to every handler registered for a type', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();
      const first = jest.fn();
      const second = jest.fn();
      wsService.on('trip_updated', first);
      wsService.on('trip_updated', second);
      wsService.off('trip_updated', first);

      deliverMessage(socket, { type: 'trip_updated', data: { status: 'ARRIVED' } });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith({ status: 'ARRIVED' });
    });

    it('ignores off for a type that was never registered', async () => {
      expect(() => wsService.off('ghost', jest.fn())).not.toThrow();
    });

    it('ignores malformed payloads', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();
      const handler = jest.fn();
      wsService.on('trip_updated', handler);

      expect(() => socket.onmessage!({ data: '{not json' })).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });

    describe('auth_success', () => {
      it('marks the session authenticated, resubscribes channels and flushes the queue', async () => {
        await wsService.connect(WS_URL);
        const socket = openSocket();
        expect(wsService.isAuth()).toBe(false);

        wsService.subscribe('driver:123', 'driver-123');
        deliverMessage(socket, { type: 'auth_success' });

        expect(wsService.isAuth()).toBe(true);
        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'subscribe', channel: 'driver:123', id: 'driver-123' }),
        );
      });

      it('flushes messages that were queued while disconnected', async () => {
        await wsService.connect(WS_URL);
        const socket = currentSocket();
        socket.readyState = CONNECTING;

        // subscribe() while not open queues the message
        wsService.subscribe('driver:123', 'driver-123');
        expect(socket.send).not.toHaveBeenCalled();

        // auth_success while still connecting keeps the queue; once open it flushes
        deliverMessage(socket, { type: 'auth_success' });
        socket.readyState = OPEN;
        deliverMessage(socket, { type: 'auth_success' });

        expect(socket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'subscribe', channel: 'driver:123', id: 'driver-123' }),
        );
      });
    });

    describe('auth_error', () => {
      it('notifies auth error handlers and drops the authenticated flag', async () => {
        await wsService.connect(WS_URL);
        const socket = openSocket();
        deliverMessage(socket, { type: 'auth_success' });
        expect(wsService.isAuth()).toBe(true);

        const onAuthError = jest.fn();
        wsService.onAuthError(onAuthError);

        deliverMessage(socket, { type: 'auth_error', code: 4001, message: 'bad token' });

        expect(onAuthError).toHaveBeenCalledWith(4001, 'bad token');
        expect(wsService.isAuth()).toBe(false);
      });

      it('auth error dispose stops future notifications', async () => {
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const onAuthError = jest.fn();
        const dispose = wsService.onAuthError(onAuthError);
        dispose();

        deliverMessage(socket, { type: 'auth_error', code: 4001, message: 'bad token' });

        expect(onAuthError).not.toHaveBeenCalled();
      });
    });

    describe('trip_assigned notifications', () => {
      it('presents a local notification when the app is backgrounded', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const { AppState } = require('react-native');
        AppState.currentState = 'background';

        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't1' } });

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
          content: {
            title: 'New Trip!',
            body: 'You have been assigned a new trip request.',
            data: { tripId: 't1' },
            sound: 'notification.wav',
            priority: 4,
            vibrate: [0, 250, 250, 250],
          },
          trigger: null,
          channelId: 'trip-alerts',
        });
      });

      it('falls back to the default sound when the custom sound fails', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock)
          .mockRejectedValueOnce(new Error('sound missing'))
          .mockResolvedValue('id');
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const { AppState } = require('react-native');
        AppState.currentState = 'background';

        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't1' } });

        await jest.advanceTimersByTimeAsync(0);

        const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[1][0].content.sound).toBe('default');
      });

      it('warns when both notification attempts fail', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
          new Error('no notifications'),
        );
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const { AppState } = require('react-native');
        AppState.currentState = 'background';

        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't1' } });

        await jest.advanceTimersByTimeAsync(0);

        expect(warnSpy).toHaveBeenCalledWith(
          '[WebSocketService] Failed to present notification:',
          expect.any(Error),
        );
        warnSpy.mockRestore();
      });

      it('throttles duplicate notifications within five seconds', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const { AppState } = require('react-native');
        AppState.currentState = 'background';

        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't1' } });
        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't2' } });

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(6000);
        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't3' } });

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      });

      it('does not notify while the app is active', async () => {
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const { AppState } = require('react-native');
        AppState.currentState = 'active';

        deliverMessage(socket, { type: 'trip_assigned', data: { tripId: 't1' } });

        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      });

      it('tolerates a trip_assigned message without data', async () => {
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('id');
        await wsService.connect(WS_URL);
        const socket = openSocket();
        const { AppState } = require('react-native');
        AppState.currentState = 'background';

        deliverMessage(socket, { type: 'trip_assigned' });

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.objectContaining({ data: { tripId: undefined } }),
          }),
        );
      });
    });
  });

  describe('onclose', () => {
    it.each([4001, 4002])('reports auth-error close code %s', async (code) => {
      await wsService.connect(WS_URL);
      const socket = openSocket();
      deliverMessage(socket, { type: 'auth_success' });
      const onAuthError = jest.fn();
      wsService.onAuthError(onAuthError);

      socket.onclose!({ code, reason: 'token rejected' });

      expect(onAuthError).toHaveBeenCalledWith(code, 'token rejected');
      expect(wsService.isAuth()).toBe(false);
    });

    it('uses a generic reason when the close frame has none', async () => {
      await wsService.connect(WS_URL);
      const onAuthError = jest.fn();
      wsService.onAuthError(onAuthError);

      currentSocket().onclose!({ code: 4001 });

      expect(onAuthError).toHaveBeenCalledWith(4001, 'Authentication failed');
    });

    it('stops the heartbeat on a normal close', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(futureToken);
      await wsService.connect(WS_URL);
      const socket = openSocket();
      await socket.onopen!();
      socket.send.mockClear();

      socket.onclose!({ code: 1000 });

      jest.advanceTimersByTime(60000);
      expect(socket.send).not.toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });

    it('ignores non-auth close codes', async () => {
      await wsService.connect(WS_URL);
      const onAuthError = jest.fn();
      wsService.onAuthError(onAuthError);

      currentSocket().onclose!({ code: 1000 });

      expect(onAuthError).not.toHaveBeenCalled();
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('sends subscribe and unsubscribe while connected', async () => {
      await wsService.connect(WS_URL);
      const socket = openSocket();

      wsService.subscribe('driver:1', 'd1');
      wsService.unsubscribe('driver:1', 'd1');

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', channel: 'driver:1', id: 'd1' }),
      );
      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'unsubscribe', channel: 'driver:1', id: 'd1' }),
      );
    });

    it('queues subscribe while disconnected and resubscribes after reconnect', async () => {
      await wsService.connect(WS_URL);
      const socket = currentSocket();
      socket.readyState = CONNECTING;

      wsService.subscribe('driver:1', 'd1');
      socket.readyState = OPEN;

      deliverMessage(socket, { type: 'auth_success' });

      expect(socket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribe', channel: 'driver:1', id: 'd1' }),
      );
    });
  });

  describe('app state transitions', () => {
    it('stops the heartbeat when backgrounded and restarts it on activation', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(futureToken);
      await wsService.connect(WS_URL);
      const socket = openSocket();
      await socket.onopen!();
      socket.send.mockClear();

      mockAppStateListeners.forEach((listener) => listener('background'));
      jest.advanceTimersByTime(60000);
      expect(socket.send).not.toHaveBeenCalled();

      mockAppStateListeners.forEach((listener) => listener('active'));
      jest.advanceTimersByTime(25000);
      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });

    it('reconnects a dead socket on activation', async () => {
      await wsService.connect(WS_URL);
      const socket = currentSocket();
      socket.readyState = CONNECTING;

      mockAppStateListeners.forEach((listener) => listener('active'));

      expect(socket.reconnect).toHaveBeenCalledTimes(1);
    });

    it('ignores app states that are neither background nor active', async () => {
      (SecureStorage.getAccessToken as jest.Mock).mockResolvedValue(futureToken);
      await wsService.connect(WS_URL);
      const socket = openSocket();
      await socket.onopen!();
      socket.send.mockClear();

      mockAppStateListeners.forEach((listener) => listener('inactive'));
      jest.advanceTimersByTime(25000);

      expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
      expect(socket.reconnect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('closes the socket and clears all session state', async () => {
      const onAuthError = jest.fn();
      wsService.onAuthError(onAuthError);
      await wsService.connect(WS_URL);
      const handler = jest.fn();
      wsService.on('trip_updated', handler);
      openSocket();

      wsService.disconnect();

      expect(currentSocket().close).toHaveBeenCalledTimes(1);
      expect(wsService.isConnected()).toBe(false);
      expect(wsService.getCurrentUrl()).toBeNull();

      // The dying socket is detached: late frames cannot reach the cleared handlers
      const socket = currentSocket();
      socket.readyState = OPEN;
      expect(socket.onclose).toBeNull();
      expect(socket.onmessage).toBeNull();
      expect(socket.onopen).toBeNull();
      expect(handler).not.toHaveBeenCalled();
      expect(onAuthError).not.toHaveBeenCalled();
    });
  });
});
