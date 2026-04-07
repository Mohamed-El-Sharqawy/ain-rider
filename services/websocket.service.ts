import ReconnectingWebSocket from 'reconnecting-websocket';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';

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

  connect(wsUrl: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.currentUrl = wsUrl;

    this.ws = new ReconnectingWebSocket(wsUrl, [], {
      maxRetries: Infinity,
      reconnectionDelayGrowFactor: 1.5,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
    });

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handlers = this.handlers.get(message.type);
        if (handlers) {
          handlers.forEach((handler) => handler(message.data));
        }
        if (message.type === 'trip_assigned' && AppState.currentState !== 'active') {
          const now = Date.now();
          if (now - this.lastNotificationTime > 2000) {
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

    this.ws.onopen = () => {
      console.log('[WebSocketService] Connected');
      this.startHeartbeat();
      this.resubscribeAll();
      this.flushQueue();
      this.openResolvers.forEach(r => r());
      this.openResolvers = [];
    };

    this.ws.onclose = () => {
      console.log('[WebSocketService] Disconnected, will auto-reconnect');
      this.stopHeartbeat();
    };

    this.setupAppStateListener();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  reconnect(): void {
    if (this.ws) {
      this.ws.reconnect();
    } else if (this.currentUrl) {
      this.connect(this.currentUrl);
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
      await scheduleWithChannel('new_trip.mp3');
    } catch {
      try {
        await scheduleWithChannel('default');
      } catch (err) {
        console.warn('[WebSocketService] Failed to present notification:', err);
      }
    }
  }

  private send(message: Record<string, any>): void {
    console.log('[WebSocketService] Attempting to send:', message.type, message);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[WebSocketService] Sent immediately');
    } else {
      console.log('[WebSocketService] Connection not open, queuing message. State:', this.ws?.readyState);
      this.messageQueue.push(message);
    }
  }

  private flushQueue(): void {
    console.log('[WebSocketService] Flushing queue, items:', this.messageQueue.length);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        console.log('[WebSocketService] Sending queued message:', msg.type);
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
      console.log('[WebSocketService] Re-subscribing:', channel, id);
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
        if (nextState === 'active' && this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.reconnect();
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
