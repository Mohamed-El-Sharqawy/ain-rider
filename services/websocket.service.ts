import ReconnectingWebSocket from 'reconnecting-websocket';
import { AppState, type AppStateStatus } from 'react-native';

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: ReconnectingWebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private currentUrl: string | null = null;
  private messageQueue: Record<string, any>[] = [];

  connect(wsUrl: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.currentUrl = wsUrl;

    this.ws = new ReconnectingWebSocket(wsUrl, [], {
      maxRetries: Infinity,
      reconnectionDelayGrowFactor: 1.5,
      maxReconnectionDelay: 10000,
    });

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const handlers = this.handlers.get(message.type);
        if (handlers) {
          handlers.forEach((handler) => handler(message.data));
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onopen = () => {
      this.startHeartbeat();
      this.flushQueue();
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
    };

    this.setupAppStateListener();
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
    this.currentUrl = null;
  }

  subscribe(channel: string, id: string): void {
    this.send({ type: 'subscribe', channel, id });
  }

  unsubscribe(channel: string, id: string): void {
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
