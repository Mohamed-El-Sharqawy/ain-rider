import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiClient {
  static async request(endpoint: string, options: RequestInit = {}) {
    const token = await SecureStore.getItemAsync('accessToken');
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-Type': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || `API Error: ${response.status}`);
    }

    return data;
  }

  static async verifyOtp(idToken: string) {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ idToken })
    });
  }

  static async register(data: any) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (res.accessToken) {
      await SecureStore.setItemAsync('accessToken', res.accessToken);
      if (res.refreshToken) {
        await SecureStore.setItemAsync('refreshToken', res.refreshToken);
      }
    }
    
    return res;
  }
}
