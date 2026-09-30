import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../services/websocket.service';
import { ApiConfig } from '../lib/config/constants';

const WS_URL = ApiConfig.wsUrl;

export function useWebSocket(autoConnect: boolean = false) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (autoConnect) {
      wsService.connect(WS_URL);
      setIsConnected(true);
    }

    return () => {
      if (autoConnect) {
        wsService.disconnect();
        setIsConnected(false);
      }
    };
  }, [autoConnect]);

  const connect = useCallback(() => {
    if (!isConnected) {
      wsService.connect(WS_URL);
      setIsConnected(true);
    }
  }, [isConnected]);

  const disconnect = useCallback(() => {
    wsService.disconnect();
    setIsConnected(false);
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
    isConnected,
  };
}
