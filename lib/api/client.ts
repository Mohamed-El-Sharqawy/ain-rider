import { SecureStorage } from '../storage/secure';
import { ApiConfig, RetryConfig } from '../config/constants';

export interface ApiErrorResponse {
  error?: {
    message: string | string[];
    code?: string;
  };
  message?: string | string[];
  retryAfterSeconds?: number;
  [key: string]: unknown;
}

export const API_BASE_URL = ApiConfig.baseUrl;

export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

if (!validateUrl(API_BASE_URL)) {
  throw new Error(`[ApiClient] Invalid API_BASE_URL: "${API_BASE_URL}". Must be a valid HTTP(S) URL.`);
}

export function assertResponseShape<T extends Record<string, unknown>>(
  data: unknown,
  requiredKeys: (keyof T)[],
  label: string,
): void {
  if (!data || typeof data !== 'object') {
    throw new Error(`[ApiClient] ${label}: Expected object, got ${typeof data}`);
  }
  const obj = data as Record<string, unknown>;
  for (const key of requiredKeys as string[]) {
    if (!(key in obj)) {
      throw new Error(`[ApiClient] ${label}: Missing required field "${key}"`);
    }
  }
}

export class ApiError extends Error {
  status: number;
  data: ApiErrorResponse | null;

  constructor(status: number, message: string, data?: ApiErrorResponse | null) {
    super(message);
    this.status = status;
    this.data = data ?? null;
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token?: string) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request deduplication - prevents duplicate concurrent requests
const pendingRequests = new Map<string, Promise<unknown>>();

function createRequestKey(endpoint: string, method: string, body?: unknown): string {
  const bodyKey = body ? JSON.stringify(body) : '';
  return `${method}:${endpoint}:${bodyKey}`;
}

const MAX_RETRIES = RetryConfig.maxRetries;
const BASE_DELAY_MS = RetryConfig.baseDelayMs;

const CACHE_TTL_MS = 30_000;
const responseCache = new Map<string, { data: unknown; ts: number }>();

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  responseCache.set(key, { data, ts: Date.now() });
}

export function clearResponseCache(): void {
  responseCache.clear();
}

function isRetryable(status: number): boolean {
  return status >= 500 || status === 429;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REQUEST_TIMEOUT_MS = 30_000;

function createTimeoutSignal(existingSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (existingSignal) {
    if (existingSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      existingSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

export const ApiClient = {
  async request<T>(endpoint: string, options: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
    const method = options.method || 'GET';
    
    if (method === 'GET') {
      const requestKey = createRequestKey(endpoint, method);
      const cached = getCached<T>(requestKey);
      if (cached) {
        return cached;
      }
      const pendingRequest = pendingRequests.get(requestKey);
      if (pendingRequest) {
        return pendingRequest as Promise<T>;
      }
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const token = await SecureStorage.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const executeRequest = async (): Promise<T> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(backoff);
        }

        const { signal: timeoutSignal, cleanup: timeoutCleanup } = createTimeoutSignal(options.signal);

        let response: Response;
        try {
          response = await fetch(url, { ...options, headers, signal: timeoutSignal });
        } catch (error) {
          timeoutCleanup();
          if (error instanceof Error && error.name === 'AbortError') {
            if (options.signal?.aborted) {
              throw new ApiError(0, 'Request cancelled', { cancelled: true });
            }
            throw new ApiError(0, 'Request timed out', { timeout: true });
          }
          lastError = error as Error;
          if (attempt < MAX_RETRIES) continue;
          throw lastError;
        }
        timeoutCleanup();

        // Handle 401 Unauthorized - Token might be expired
        if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({
                resolve: async (token: string) => {
                  try {
                    const retryHeaders = {
                      ...headers,
                      'Authorization': `Bearer ${token}`,
                    };
                    const { signal: retrySignal, cleanup: retryCleanup } = createTimeoutSignal(options.signal);
                    let retryResponse: Response;
                    try {
                      retryResponse = await fetch(url, { ...options, headers: retryHeaders, signal: retrySignal });
                    } finally {
                      retryCleanup();
                    }
                    let retryData: ApiErrorResponse | null;
                    try {
                      if (retryResponse.status !== 204) {
                        retryData = await retryResponse.json();
                      } else {
                        retryData = null;
                      }
                    } catch {
                      retryData = null;
                    }
                    if (!retryResponse.ok) {
                      const msg = Array.isArray(retryData?.error?.message)
                        ? retryData!.error!.message.join(', ')
                        : retryData?.error?.message ?? (Array.isArray(retryData?.message) ? retryData!.message.join(', ') : retryData?.message) ?? `API Error: ${retryResponse.status}`;
                      reject(new ApiError(retryResponse.status, msg, retryData));
                    } else {
                      resolve(retryData as T);
                    }
                  } catch (err) {
                    reject(err);
                  }
                },
                reject,
              });
            });
          }

          try {
            const newToken = await this.refreshToken();
            if (newToken) {
              processQueue(null, newToken);

              const retryHeaders = {
                ...headers,
                'Authorization': `Bearer ${newToken}`,
              };

              const { signal: retrySignal, cleanup: retryCleanup } = createTimeoutSignal(options.signal);
              try {
                response = await fetch(url, { ...options, headers: retryHeaders, signal: retrySignal });
              } finally {
                retryCleanup();
              }
            } else {
              processQueue(new Error('Token refresh failed'));
            }
          } catch (refreshError) {
            processQueue(refreshError as Error);
          }
        }

        let data: ApiErrorResponse | null;
        try {
          if (response.status !== 204) {
            data = await response.json();
          } else {
            data = null;
          }
        } catch {
          data = null;
        }

        if (!response.ok) {
          const waitTime = response.headers.get('Retry-After');
          if (waitTime && data) {
            data.retryAfterSeconds = parseInt(waitTime, 10);
          }

          if (isRetryable(response.status) && attempt < MAX_RETRIES) {
            const retryAfter = data?.retryAfterSeconds
              ? data.retryAfterSeconds * 1000
              : BASE_DELAY_MS * Math.pow(2, attempt);
            await delay(retryAfter);
            continue;
          }

          const msg = Array.isArray(data?.error?.message)
            ? data!.error!.message.join(', ')
            : data?.error?.message ?? (Array.isArray(data?.message) ? data!.message.join(', ') : data?.message) ?? `API Error: ${response.status}`;
          throw new ApiError(response.status, msg, data);
        }

        return data as T;
      }

      throw lastError ?? new Error('Request failed after retries');
    };

    // For GET requests, use deduplication
    if (method === 'GET') {
      const requestKey = createRequestKey(endpoint, method);
      const promise = executeRequest().then((result) => {
        setCache(requestKey, result);
        return result;
      }).finally(() => {
        pendingRequests.delete(requestKey);
      });
      pendingRequests.set(requestKey, promise);
      return promise;
    }

    return executeRequest();
  },

  async refreshToken(): Promise<string | null> {
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const refreshToken = await SecureStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': 'mobile',
            'Authorization': `Bearer ${refreshToken}`,
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          throw new Error(`Refresh request failed with status: ${response.status}`);
        }

        const data = await response.json();
        const { accessToken, refreshToken: newRefreshToken } = data;

        if (accessToken && newRefreshToken) {
          await SecureStorage.saveTokens(accessToken, newRefreshToken);
          return accessToken;
        }

        throw new Error('Invalid refresh response format');
      } catch (error) {
        await SecureStorage.clearTokens();
        return null;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async post<T>(endpoint: string, body?: any, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  },

  async get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', signal });
  },

  async patch<T>(endpoint: string, body?: any, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  },

  async delete<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', signal });
  },

  async uploadFiles<T>(
    endpoint: string,
    files: Array<{ fieldname: string; uri?: string; type?: string; name?: string; value?: string }>,
    method: 'POST' | 'PATCH' = 'POST'
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await SecureStorage.getAccessToken();

    const formData = new FormData();
    files.forEach((file) => {
      if (file.uri) {
        formData.append(file.fieldname, {
          uri: file.uri,
          type: file.type,
          name: file.name,
        } as any);
      } else if (file.value !== undefined) {
        formData.append(file.fieldname, file.value);
      }
    });

    const headers: Record<string, string> = {
      'X-Client-Type': 'mobile',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type - let fetch/FormData set it with the correct boundary

    const { signal: uploadSignal, cleanup: uploadCleanup } = createTimeoutSignal();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: formData,
        signal: uploadSignal,
      });
    } finally {
      uploadCleanup();
    }

    if (response.status === 401) {
      try {
        const newToken = await this.refreshToken();
        if (newToken) {
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };
          const { signal: retrySignal, cleanup: retryCleanup } = createTimeoutSignal();
          try {
            response = await fetch(url, {
              method,
              headers: retryHeaders,
              body: formData,
              signal: retrySignal,
            });
          } finally {
            retryCleanup();
          }
        }
      } catch (refreshError) {
        // Refresh failed, proceed with original response
      }
    }

    let data: ApiErrorResponse | null;
    try {
      if (response.status !== 204) {
        data = await response.json();
      } else {
        data = null;
      }
    } catch {
      data = null;
    }

    if (!response.ok) {
      const msg = Array.isArray(data?.error?.message)
        ? data!.error!.message.join(', ')
        : data?.error?.message ?? (Array.isArray(data?.message) ? data!.message.join(', ') : data?.message) ?? `API Error: ${response.status}`;
      throw new ApiError(response.status, msg, data);
    }

    return data as T;
  }
};
