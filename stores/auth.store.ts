import { create } from 'zustand';
import { AuthApi } from '../lib/api/auth';
import { RegisterPayload, UserRole } from '../lib/api/types';

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  setAuth: (isAuthenticated: boolean, role: UserRole | null) => void;
  logout: () => void;
  registerUser: (data: RegisterPayload) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  role: null,
  setAuth: (isAuthenticated, role) => set({ isAuthenticated, role }),
  logout: () => set({ isAuthenticated: false, role: null }),
  registerUser: async (data: RegisterPayload) => {
    const res = await AuthApi.register(data);
    if (res.success) {
      set({ isAuthenticated: true, role: res.user.role });
    } else {
      throw new Error('Registration failed');
    }
  }
}));
