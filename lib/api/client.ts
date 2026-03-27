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

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }
};
