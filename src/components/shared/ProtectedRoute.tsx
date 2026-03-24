// ─── Protected Route ────────────────────────────────────────────────────────
// Guards protected pages — redirects unauthenticated users to login.
// Syncs auth state to Zustand on successful verification.

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { useGetMe } from '@/pages/login/services/queries';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser, clear } = useAuthStore();
  const location = useLocation();
  const { data, isLoading, isError, isSuccess } = useGetMe();

  useTokenRefresh();

  // Sync auth to Zustand on first successful fetch
  useEffect(() => {
    if (isSuccess && data && !isAuthenticated) {
      if (data.role === 'ADMIN' || data.role === 'SUPPORT') {
        setUser(data);
      }
    }
  }, [isSuccess, data, isAuthenticated, setUser]);

  // Clear auth on error
  useEffect(() => {
    if (isError && isAuthenticated) {
      clear();
    }
  }, [isError, isAuthenticated, clear]);

  // Handle global unauthorized events (from Axios 401 interceptor)
  useEffect(() => {
    const handleUnauthorized = () => clear();
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [clear]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (isError || !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
