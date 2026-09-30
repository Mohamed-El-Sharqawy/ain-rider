import type { FetchInternalConfig, FetchInternalOptions } from './types';

let globalConfig: FetchInternalConfig | null = null;

export function configureFetchInternal(config: FetchInternalConfig): void {
  globalConfig = config;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchInternal(
  url: string,
  method: string = 'GET',
  body?: unknown,
  options: FetchInternalOptions = {},
): Promise<Response> {
  const serviceName = globalConfig?.serviceName ?? 'unknown';
  const targetService = options.targetService ?? 'unknown';
  const metrics = globalConfig?.metrics;
  const logger = globalConfig?.logger;

  metrics?.inc({ service: targetService, status: 'attempt' });

  const headers: Record<string, string> = { ...(options.headers ?? {}) };

  if (globalConfig?.internalSecret) {
    headers['x-internal-secret'] = globalConfig.internalSecret;
  }

  type RawBody = string | ArrayBuffer | FormData | Blob | ReadableStream | Uint8Array;
  let serializedBody: RawBody | string | undefined;

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (
      typeof body === 'string' ||
      body instanceof ArrayBuffer ||
      body instanceof Uint8Array ||
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ReadableStream
    ) {
      serializedBody = body as RawBody;
    } else {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      serializedBody = JSON.stringify(body);
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: serializedBody,
      });

      metrics?.inc({ service: targetService, status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
        await delay(backoff);
      }
    }
  }

  metrics?.inc({ service: targetService, status: 'failed' });
  logger?.error(`[${serviceName}] Proxy to ${targetService} failed after ${MAX_RETRIES + 1} attempts`, {
    url,
    method,
    error: String(lastError),
  });
  throw lastError;
}
