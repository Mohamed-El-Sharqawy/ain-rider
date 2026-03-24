import { useQuery } from '@tanstack/react-query';
import { authApi } from './api';
import { transformAuthUser, type AdminUser } from './transformers';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

// Pure query — fetches current user from /auth/me endpoint.
// Runs once per app load, cached forever until explicitly invalidated.
// No side effects — route guards handle Zustand sync based on result.
export const useGetMe = () => {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async (): Promise<AdminUser> => {
      const { data } = await authApi.getMe();
      return transformAuthUser(data);
    },
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
