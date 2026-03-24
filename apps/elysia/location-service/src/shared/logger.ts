export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    service: 'location-service',
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  }));
}
