const wsUrl = import.meta.env.VITE_WS_URL;
if (!wsUrl && import.meta.env.PROD) {
  console.error('[FATAL] VITE_WS_URL is not set. WebSocket connections will fail. Set it in your .env file.');
}

export const ApiConfig = {
  gatewayUrl: import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:3000',
  wsUrl: wsUrl ?? 'ws://localhost:3001/ws',
} as const;
