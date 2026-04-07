export interface MetricsHooks {
  inc: (labels: { service: string; status: string }) => void;
}

export interface LoggerHooks {
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface FetchInternalConfig {
  serviceName: string;
  metrics?: MetricsHooks;
  logger?: LoggerHooks;
}

export interface FetchInternalOptions {
  targetService?: string;
  headers?: Record<string, string>;
}
