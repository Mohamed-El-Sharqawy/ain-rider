// ─── Guest Route ────────────────────────────────────────────────────────────
// Redirects authenticated users away from login page.
// Shows spinner while checking, then either redirects or shows login form.

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { useGetMe } from '@/pages/login/services/queries';

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser } = useAuthStore();
  const location = useLocation();
  const { data, isLoading, isSuccess } = useGetMe();

  // Where to redirect if already logged in
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  // Sync auth to Zustand on first successful fetch
  useEffect(() => {
    if (isSuccess && data && !isAuthenticated) {
      if (data.role === 'ADMIN' || data.role === 'SUPPORT') {
        setUser(data);
      }
    }
  }, [isSuccess, data, isAuthenticated, setUser]);

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  // User is authenticated — redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // Not authenticated — show login form
  return <>{children}</>;
}
