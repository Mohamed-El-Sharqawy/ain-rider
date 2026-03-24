import { create } from 'zustand';
import type { AdminUser } from '@/pages/login/services/transformers';

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  setUser: (user: AdminUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: true }),
  clear: () => set({ user: null, isAuthenticated: false }),
}));
