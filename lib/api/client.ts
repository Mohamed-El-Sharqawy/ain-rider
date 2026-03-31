import { SecureStorage } from '../storage/secure';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const ApiClient = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

    console.log(`[ApiClient] Request: ${options.method || 'GET'} ${url}`);

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
      console.log(`[ApiClient] Response Status: ${response.status}`);
    } catch (error) {
      console.error(`[ApiClient] Fetch Error for ${url}:`, error);
      throw error;
    }

    // Handle 401 Unauthorized - Token might be expired
    if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      console.log(`[ApiClient] 401 detected, attempting to refresh token...`);

      try {
        const newToken = await this.refreshToken();
        if (newToken) {
          // Retry original request with new token
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };

          console.log(`[ApiClient] Retrying request: ${options.method || 'GET'} ${url}`);
          const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
          console.log(`[ApiClient] Retry Response Status: ${retryResponse.status}`);

          // Use retry response for further processing
          response = retryResponse;
        }
      } catch (refreshError) {
        console.error(`[ApiClient] Token refresh failed:`, refreshError);
        // If refresh fails, we'll let the original 401 (or the refresh error) fall through
      }
    }

    // Attempt parsing JSON gracefully
    let data: any;
    try {
      if (response.status !== 204) {
        data = await response.json();
      }
    } catch (err) {
      data = null;
    }

    if (!response.ok) {
      // Look for rate limit headers precisely
      const waitTime = response.headers.get('Retry-After');
      if (waitTime) {
        data = data || {};
        data.retryAfterSeconds = parseInt(waitTime, 10);
      }

      const errorMessage = data?.error?.message || data?.message || `API Error: ${response.status}`;
      throw new ApiError(response.status, errorMessage, data);
    }

    return data as T;
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

        console.log(`[ApiClient] Requesting new access token...`);
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
          console.log(`[ApiClient] Token refresh successful`);
          return accessToken;
        }

        throw new Error('Invalid refresh response format');
      } catch (error) {
        console.error(`[ApiClient] Refresh token error:`, error);
        await SecureStorage.clearTokens();
        return null;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  },

  async uploadFiles<T>(
    endpoint: string,
    files: Array<{ fieldname: string; uri: string; type: string; name: string }>,
    method: 'POST' | 'PATCH' = 'POST'
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await SecureStorage.getAccessToken();

    const formData = new FormData();
    files.forEach((file) => {
      formData.append(file.fieldname, {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as any);
    });

    const headers: Record<string, string> = {
      'X-Client-Type': 'mobile',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type - let fetch/FormData set it with the correct boundary

    console.log(`[ApiClient] Upload: ${method} ${url}`);

    let response = await fetch(url, {
      method,
      headers,
      body: formData,
    });

    console.log(`[ApiClient] Response Status: ${response.status}`);

    // Handle 401 Unauthorized - Token might be expired
    if (response.status === 401) {
      console.log(`[ApiClient] 401 detected during upload, attempting to refresh token...`);
      try {
        const newToken = await this.refreshToken();
        if (newToken) {
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`,
          };
          console.log(`[ApiClient] Retrying upload: ${method} ${url}`);
          response = await fetch(url, {
            method,
            headers: retryHeaders,
            body: formData,
          });
          console.log(`[ApiClient] Retry Upload Response Status: ${response.status}`);
        }
      } catch (refreshError) {
        console.error(`[ApiClient] Token refresh failed during upload:`, refreshError);
      }
    }

    let data: any;
    try {
      if (response.status !== 204) {
        data = await response.json();
      }
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMessage = data?.error?.message || data?.message || `API Error: ${response.status}`;
      throw new ApiError(response.status, errorMessage, data);
    }

    return data as T;
  }
};
