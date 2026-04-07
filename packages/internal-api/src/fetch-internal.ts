import type { FetchInternalConfig, FetchInternalOptions } from './types';

let globalConfig: FetchInternalConfig | null = null;

export function configureFetchInternal(config: FetchInternalConfig): void {
  globalConfig = config;
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

  try {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };

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

    const res = await fetch(url, {
      method,
      headers,
      body: serializedBody,
    });

    metrics?.inc({ service: targetService, status: res.ok ? 'success' : 'error' });

    return res;
  } catch (error) {
    metrics?.inc({ service: targetService, status: 'failed' });
    logger?.error(`[${serviceName}] Proxy to ${targetService} failed`, {
      url,
      method,
      error: String(error),
    });
    throw error;
  }
}
