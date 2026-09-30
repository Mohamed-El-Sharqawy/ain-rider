export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    service: 'websocket-server',
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  }));
}
