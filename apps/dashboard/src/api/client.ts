import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ApiConfig } from '@/config/constants';

export interface ApiErrorResponse {
  error?: {
    message: string | string[];
    code?: string;
  };
  message?: string | string[];
  [key: string]: unknown;
}

export interface ApiError {
  status: number;
  code?: string;
  message: string;
  raw: ApiErrorResponse;
}

const baseURL = ApiConfig.gatewayUrl;

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If not a 401 or already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // The refresh endpoint itself failed with 401. This is an externally
    // initiated refresh call: internal refresh calls carry _retry and are
    // rejected by the _retry check above, and their failure is dispatched
    // exactly once by the catch below.
    if (originalRequest.url?.includes('/auth/refresh')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      // _retry marks this as the internal refresh call so its own failure is
      // not double-reported as auth:unauthorized (the catch block reports it).
      await api.post('/auth/refresh', undefined, { _retry: true } as AxiosRequestConfig);
      processQueue(null);
      isRefreshing = false;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError);
      isRefreshing = false;
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      return Promise.reject(refreshError);
    }
  },
);

/** Extracts a human-readable Arabic/English error message from an Axios error or generic Error. */
// TODO: Localize all error messages via i18n (replace hardcoded strings with translation keys)
export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data as ApiErrorResponse | undefined;
    
    if (errorData?.error?.message) {
      const message = errorData.error.message;
      if (Array.isArray(message)) return message.join(', ');
      return String(message);
    }
    
    if (errorData?.message) {
      const message = errorData.message;
      if (Array.isArray(message)) return message.join(', ');
      return String(message);
    }
    
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function toApiError(error: unknown): ApiError | null {
  if (!axios.isAxiosError(error)) return null;
  const errorData = error.response?.data as ApiErrorResponse | undefined;
  const message = errorData?.error?.message
    ? (Array.isArray(errorData.error.message) ? errorData.error.message.join(', ') : errorData.error.message)
    : errorData?.message
      ? (Array.isArray(errorData.message) ? errorData.message.join(', ') : String(errorData.message))
      : (error.message);

  return {
    status: error.response?.status ?? 0,
    code: errorData?.error?.code,
    message,
    raw: errorData ?? {},
  };
}
