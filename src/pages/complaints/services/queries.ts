import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { complaintsApi, type ComplaintFilters } from './api';
import { transformComplaint } from './transformers';

export interface PaginatedComplaints {
  data: ReturnType<typeof transformComplaint>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const complaintKeys = {
  all: ['complaints'] as const,
  list: (filters: ComplaintFilters) => [...complaintKeys.all, 'list', filters] as const,
  detail: (id: string) => [...complaintKeys.all, 'detail', id] as const,
};

export const useGetComplaints = (filters: ComplaintFilters) => {
  return useQuery({
    queryKey: complaintKeys.list(filters),
    queryFn: () =>
      complaintsApi.getAll(filters).then((r) => ({
        data: r.data.data.map(transformComplaint),
        total: r.data.total,
        page: r.data.page,
        limit: r.data.limit,
        totalPages: r.data.totalPages,
      })),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetComplaintById = (id: string) => {
  return useQuery({
    queryKey: complaintKeys.detail(id),
    queryFn: () => complaintsApi.getById(id).then((r) => transformComplaint(r.data)),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
