export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    service: 'match-service',
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  }));
}
