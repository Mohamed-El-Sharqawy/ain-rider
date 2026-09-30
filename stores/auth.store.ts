import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AuthApi } from '../lib/api/auth';
import { RegisterPayload, UserRole } from '../lib/api/types';
import { SecureStorage } from '../lib/storage/secure';

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  userId: string | null;
  isOnboarding: boolean;
  isLoading: boolean;
  error: string | null;
  tokenExpiry: number | null;
  isRefreshing: boolean;
  lastAttemptAt: number;
  setAuth: (isAuthenticated: boolean, role: UserRole | null, userId?: string | null) => void;
  registerUser: (data: RegisterPayload) => Promise<void>;
  completeOnboarding: () => void;
  setOnboardingStatus: (isOnboarding: boolean) => void;
  setTokenExpiry: (expiry: number | null) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  logout: () => Promise<void>;
  clearError: () => void;
  canAttempt: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  devtools((set, get) => ({
  isAuthenticated: false,
  role: null,
  userId: null,
  isOnboarding: false,
  isLoading: false,
  error: null,
  tokenExpiry: null,
  isRefreshing: false,
  lastAttemptAt: 0,
  setAuth: (isAuthenticated, role, userId) => set({ isAuthenticated, role, userId: userId ?? null }),
  setTokenExpiry: (tokenExpiry) => set({ tokenExpiry }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await AuthApi.logout().catch(() => {});
      await SecureStorage.clearTokens();
      set({ isAuthenticated: false, role: null, userId: null, isOnboarding: false, isLoading: false, tokenExpiry: null });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Logout failed';
      set({ error: message, isLoading: false });
    }
  },
  registerUser: async (data: RegisterPayload) => {
    if (!get().canAttempt()) {
      throw new Error('Please wait before trying again');
    }
    set({ isLoading: true, error: null });
    try {
      const res = await AuthApi.register(data);
      if (res.success) {
        await SecureStorage.saveTokens(res.accessToken, res.refreshToken);
        set({ isAuthenticated: true, role: res.user.role, userId: res.user.id, isOnboarding: true, isLoading: false });
      } else {
        throw new Error('Registration failed');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Registration failed';
      set({ error: message, isLoading: false });
      throw e;
    }
  },
  completeOnboarding: () => set({ isOnboarding: false }),
  setOnboardingStatus: (isOnboarding) => set({ isOnboarding }),
  clearError: () => set({ error: null }),
  canAttempt: () => {
    const now = Date.now();
    const { lastAttemptAt } = get();
    if (now - lastAttemptAt < 2000) return false;
    set({ lastAttemptAt: now });
    return true;
  },
}), { name: 'auth-store' })
);
