import axios from 'axios';

const baseURL = import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data;
    
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
    
    return error.message ?? 'An unexpected error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
