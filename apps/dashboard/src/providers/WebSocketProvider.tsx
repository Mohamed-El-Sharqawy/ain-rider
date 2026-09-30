import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ApiConfig } from '@/config/constants';

interface WebSocketMessage {
  type: string;
  channel?: string;
  id?: string;
  data?: unknown;
  timestamp?: number;
}

type MessageHandler<T = unknown> = (data: T) => void;

interface WebSocketContextType {
  isConnected: boolean;
  isAuthed: boolean;
  subscribe: (channel: string, id: string) => void;
  unsubscribe: (channel: string, id: string) => void;
  on: (eventType: string, handler: MessageHandler) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

const WS_URL = ApiConfig.wsUrl;
const BASE_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const PING_INTERVAL = 30000;

async function fetchWsToken(): Promise<string | null> {
  try {
    const res = await fetch(`${ApiConfig.gatewayUrl}/auth/ws-token?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, clear } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectingRef = useRef(false);
  const isAuthedRef = useRef(false);
  const userIdRef = useRef<string | undefined>(undefined);
  const isAuthenticatedRef = useRef(false);
  const clearRef = useRef(clear);
  const mountedRef = useRef(true);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  const connectRef = useRef<() => void>(() => {});

  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { clearRef.current = clear; }, [clear]);
  useEffect(() => { isAuthedRef.current = isAuthed; }, [isAuthed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticatedRef.current || isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    isConnectingRef.current = true;
    intentionalCloseRef.current = false;
    setIsAuthed(false);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      if (!mountedRef.current || intentionalCloseRef.current) {
        ws.close();
        return;
      }

      const token = await fetchWsToken();

      if (!mountedRef.current || intentionalCloseRef.current) {
        ws.close();
        return;
      }

      if (!token) {
        console.error('[WebSocket] Failed to get WS token');
        isConnectingRef.current = false;
        ws.close();
        return;
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        if (message.type === 'ping') {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
          return;
        }

        if (message.type === 'pong') return;

        if (message.type === 'auth_success') {
          isConnectingRef.current = false;
          reconnectAttemptRef.current = 0;
          setIsConnected(true);
          setIsAuthed(true);

          if (userIdRef.current) {
            ws.send(JSON.stringify({ type: 'subscribe', channel: 'user', id: userIdRef.current }));
          }

          subscriptionsRef.current.forEach((key) => {
            const [channel, id] = key.split(':');
            if (channel && id) {
              ws.send(JSON.stringify({ type: 'subscribe', channel, id }));
            }
          });

          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, PING_INTERVAL);

          return;
        }

        if (message.type === 'auth_error') {
          isConnectingRef.current = false;
          setIsAuthed(false);
          ws.close();
          return;
        }

        const handlers = handlersRef.current.get(message.type);
        if (handlers) {
          handlers.forEach((handler) => handler(message.data));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      isConnectingRef.current = false;
      wsRef.current = null;
      setIsConnected(false);
      setIsAuthed(false);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (intentionalCloseRef.current) return;

      if (event.code === 4001 || event.code === 4002) {
        clearRef.current();
        return;
      }

      if (isAuthenticatedRef.current && mountedRef.current) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        const delay = getReconnectDelay();
        reconnectAttemptRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isAuthenticatedRef.current && mountedRef.current) connectRef.current();
        }, delay);
      }
    };

    ws.onerror = () => {
      // Error will be handled by onclose
    };
  }, [getReconnectDelay]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (isAuthenticated) {
      reconnectAttemptRef.current = 0;
      connect();
    }

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setIsAuthed(false);
    };
  }, [isAuthenticated, connect]);

  const subscribe = useCallback((channel: string, id: string) => {
    const key = `${channel}:${id}`;
    subscriptionsRef.current.add(key);
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthedRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel, id }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string, id: string) => {
    const key = `${channel}:${id}`;
    subscriptionsRef.current.delete(key);
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthedRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel, id }));
    }
  }, []);

  const on = useCallback((eventType: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    return () => {
      const handlers = handlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, isAuthed, subscribe, unsubscribe, on }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
