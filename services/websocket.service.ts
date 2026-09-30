import ReconnectingWebSocket from 'reconnecting-websocket';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SecureStorage } from '../lib/storage/secure';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as Notifications.NotificationBehavior),
});

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: ReconnectingWebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private currentUrl: string | null = null;
  private messageQueue: Record<string, any>[] = [];
  private activeSubscriptions: Map<string, string> = new Map();
  private openResolvers: (() => void)[] = [];
  private lastNotificationTime = 0;
  private isAuthenticated = false;
  private authErrorHandlers: Set<(code: number, message: string) => void> = new Set();

  async connect(wsUrl: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.currentUrl = wsUrl;
    this.isAuthenticated = false;

    // Get auth token
    const token = await SecureStorage.getAccessToken();
    const { isTokenExpired } = await import('../lib/utils/jwt');

    // Append token to URL as query param only if it's NOT expired.
    // If it is expired, we connect without it and let the onopen fresh fetch handle it.
    const urlWithAuth = (token && !isTokenExpired(token))
      ? `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : wsUrl;

    this.ws = new ReconnectingWebSocket(urlWithAuth, [], {
      maxRetries: Infinity,
      reconnectionDelayGrowFactor: 1.5,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
    });

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'ping') {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
          return;
        }

        if (message.type === 'auth_success') {
          this.isAuthenticated = true;
          this.resubscribeAll();
          this.flushQueue();
          return;
        }

        if (message.type === 'auth_error') {
          this.isAuthenticated = false;
          this.authErrorHandlers.forEach(h => h(message.code, message.message));
          return;
        }

        const handlers = this.handlers.get(message.type);
        if (handlers) {
          handlers.forEach((handler) => handler(message.data));
        }
        if (message.type === 'trip_assigned' && AppState.currentState !== 'active') {
          const now = Date.now();
          if (now - this.lastNotificationTime > 5000) {
            this.presentLocalNotification(
              'New Trip!',
              'You have been assigned a new trip request.',
              { tripId: message.data?.tripId },
            );
            this.lastNotificationTime = now;
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onopen = async () => {
      const freshToken = await SecureStorage.getAccessToken();
      if (freshToken) {
        this.send({ type: 'auth', token: freshToken });
      }
      this.startHeartbeat();
      this.openResolvers.forEach(r => r());
      this.openResolvers = [];
    };

    this.ws.onclose = (event: any) => {
      this.stopHeartbeat();
      if (event.code === 4001 || event.code === 4002) {
        this.isAuthenticated = false;
        this.authErrorHandlers.forEach(h => h(event.code, event.reason || 'Authentication failed'));
      }
    };

    this.setupAppStateListener();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  async reconnect(): Promise<void> {
    if (this.ws) {
      this.ws.reconnect();
    } else if (this.currentUrl) {
      await this.connect(this.currentUrl);
    }
  }

  waitForConnection(timeoutMs = 5000): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeoutMs);
      this.openResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.removeAppStateListener();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.handlers.clear();
    this.messageQueue = [];
    this.activeSubscriptions.clear();
    this.openResolvers = [];
    this.currentUrl = null;
  }

  subscribe(channel: string, id: string): void {
    this.activeSubscriptions.set(channel, id);
    this.send({ type: 'subscribe', channel, id });
  }

  unsubscribe(channel: string, id: string): void {
    this.activeSubscriptions.delete(channel);
    this.send({ type: 'unsubscribe', channel, id });
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.off(type, handler);
    };
  }

  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  onAuthError(handler: (code: number, message: string) => void): () => void {
    this.authErrorHandlers.add(handler);
    return () => {
      this.authErrorHandlers.delete(handler);
    };
  }

  isAuth(): boolean {
    return this.isAuthenticated;
  }

  private async presentLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    const notificationData: Record<string, unknown> | null = data ?? null;

    const makeContent = (sound: string | boolean | undefined): Notifications.NotificationContentInput => ({
      title,
      body,
      data: notificationData ?? undefined,
      sound,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: [0, 250, 250, 250],
    });

    const scheduleWithChannel = async (sound: string | boolean | undefined) => {
      const input: any = {
        content: makeContent(sound),
        trigger: null,
        channelId: 'trip-alerts',
      };
      return Notifications.scheduleNotificationAsync(input);
    };

    try {
      await scheduleWithChannel('notification.wav');
    } catch {
      try {
        await scheduleWithChannel('default');
      } catch (err) {
        console.warn('[WebSocketService] Failed to present notification:', err);
      }
    }
  }

  private send(message: Record<string, any>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private resubscribeAll(): void {
    for (const [channel, id] of this.activeSubscriptions) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'subscribe', channel, id }));
      }
    }
  }

  private setupAppStateListener(): void {
    this.removeAppStateListener();
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background') {
          this.stopHeartbeat();
        } else if (nextState === 'active') {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.startHeartbeat();
          } else if (this.ws) {
            this.ws.reconnect();
          }
        }
      },
    );
  }

  private removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const wsService = new WebSocketService();
