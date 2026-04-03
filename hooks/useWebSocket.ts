import { useEffect, useRef, useCallback } from 'react';
import { wsService } from '../services/websocket.service';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export function useWebSocket(autoConnect: boolean = false) {
  const connected = useRef(false);

  useEffect(() => {
    if (autoConnect) {
      wsService.connect(WS_URL);
      connected.current = true;
    }

    return () => {
      if (autoConnect) {
        wsService.disconnect();
        connected.current = false;
      }
    };
  }, [autoConnect]);

  const connect = useCallback(() => {
    if (!connected.current) {
      wsService.connect(WS_URL);
      connected.current = true;
    }
  }, []);

  const disconnect = useCallback(() => {
    wsService.disconnect();
    connected.current = false;
  }, []);

  const subscribe = useCallback((channel: string, id: string) => {
    wsService.subscribe(channel, id);
  }, []);

  const unsubscribe = useCallback((channel: string, id: string) => {
    wsService.unsubscribe(channel, id);
  }, []);

  const on = useCallback((type: string, handler: (data: any) => void) => {
    return wsService.on(type, handler);
  }, []);

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    on,
    isConnected: connected,
  };
}
