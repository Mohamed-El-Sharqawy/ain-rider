import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { authApi } from './api';
import { transformAuthUser } from './transformers';
import { useAuthStore } from '@/stores/authStore';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import { authKeys } from './queries';
import type { LoginDTO } from './dto';

export const useLogin = () => {
  const { setUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginDTO) => authApi.login(data),
    onSuccess: ({ data }) => {
      const { user } = data;

      if (user.role !== 'ADMIN' && user.role !== 'SUPPORT') {
        toast.error('الوصول مرفوض. يلزم حساب مدير أو دعم فني.');
        return;
      }

      const adminUser = transformAuthUser(user);
      // GuestRoute runs useGetMe() before login; 401 is cached forever (staleTime: Infinity).
      // Without this, ProtectedRoute still sees isError and redirects back to /login immediately.
      queryClient.setQueryData(authKeys.me, adminUser);
      setUser(adminUser);
      navigate('/');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useLogout = () => {
  const { clear } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Clear Zustand auth state
      clear();
      // Invalidate the /auth/me query so it refetches on next mount
      queryClient.invalidateQueries({ queryKey: authKeys.me });
      // ProtectedRoute will see isAuthenticated=false and redirect automatically
    },
  });
};
