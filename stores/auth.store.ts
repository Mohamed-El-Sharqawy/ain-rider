import { create } from 'zustand';

import { ApiClient } from '../lib/api';

interface AuthState {
  isAuthenticated: boolean;
  role: 'RIDER' | 'DRIVER' | 'ADMIN' | null;
  setAuth: (isAuthenticated: boolean, role: 'RIDER' | 'DRIVER' | 'ADMIN' | null) => void;
  logout: () => void;
  registerUser: (data: any) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  role: null,
  setAuth: (isAuthenticated, role) => set({ isAuthenticated, role }),
  logout: () => set({ isAuthenticated: false, role: null }),
  registerUser: async (data: any) => {
    const res = await ApiClient.register(data);
    if (res.success) {
      set({ isAuthenticated: true, role: res.user.role });
    } else {
      throw new Error(res.error?.message || 'Registration failed');
    }
  }
}));
