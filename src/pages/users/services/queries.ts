import { useQuery } from '@tanstack/react-query';
import { usersApi, type UserFilters } from './api';
import { transformPaginatedUsers, transformUser, transformUserStats } from './transformers';

export const userKeys = {
  all: ['users'] as const,
  list: (filters: UserFilters) => [...userKeys.all, 'list', filters] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
};

export const useGetAllUsers = (filters: UserFilters) => {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const { data } = await usersApi.getAll(filters);
      return transformPaginatedUsers(data, { page: filters.page, limit: filters.limit });
    },
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
