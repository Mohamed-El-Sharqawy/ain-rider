import { create } from 'zustand';
import { AuthApi } from '../lib/api/auth';
import { RegisterPayload, UserRole } from '../lib/api/types';
import { SecureStorage } from '../lib/storage/secure';

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  userId: string | null;
  isOnboarding: boolean;
  setAuth: (isAuthenticated: boolean, role: UserRole | null, userId?: string | null) => void;
  registerUser: (data: RegisterPayload) => Promise<void>;
  completeOnboarding: () => void;
  setOnboardingStatus: (isOnboarding: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  role: null,
  userId: null,
  isOnboarding: false,
  setAuth: (isAuthenticated, role, userId) => set({ isAuthenticated, role, userId: userId ?? null }),
  logout: async () => {
    await SecureStorage.clearTokens();
    set({ isAuthenticated: false, role: null, userId: null, isOnboarding: false });
  },
  registerUser: async (data: RegisterPayload) => {
    const res = await AuthApi.register(data);
    if (res.success) {
      await SecureStorage.saveTokens(res.accessToken, res.refreshToken);
      set({ isAuthenticated: true, role: res.user.role, userId: res.user.id, isOnboarding: true });
    } else {
      throw new Error('Registration failed');
    }
  },
  completeOnboarding: () => set({ isOnboarding: false }),
  setOnboardingStatus: (isOnboarding) => set({ isOnboarding })
}));
