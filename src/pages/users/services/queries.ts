import { useQuery } from '@tanstack/react-query';
import { usersApi, type UserFilters } from './api';
import { transformPaginatedUsers, transformUser, transformUserStats } from './transformers';

export const userKeys = {
  all: ['users'] as const,
  list: (filters: UserFilters) => [...userKeys.all, 'list', filters] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
  onboarding: (id: string) => [...userKeys.all, 'onboarding', id] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
};

export const useGetOnboardingStatus = (id: string) => {
  return useQuery({
    queryKey: userKeys.onboarding(id),
    queryFn: async () => {
      const res = await usersApi.getOnboardingStatus(id);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetAllUsers = (filters: UserFilters) => {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const { data } = await usersApi.getAll(filters);
      return transformPaginatedUsers(data, { page: filters.page, limit: filters.limit });
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetUserById = (id: string) => {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const { data } = await usersApi.getById(id);
      return transformUser(data);
    },
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetUserStats = () => {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: async () => {
      const { data } = await usersApi.getStats();
      return transformUserStats(data);
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
};
