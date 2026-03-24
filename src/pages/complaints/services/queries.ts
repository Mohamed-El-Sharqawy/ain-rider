import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { complaintsApi } from './api';
import { transformComplaint } from './transformers';

export const complaintKeys = {
  all: ['complaints'] as const,
  list: (status?: string) => ['complaints', 'list', { status }] as const,
  detail: (id: string) => ['complaints', 'detail', id] as const,
};

export const useGetComplaints = (status?: string) => {
  return useQuery({
    queryKey: complaintKeys.list(status),
    queryFn: () => complaintsApi.getAll(status).then((r) => r.data.map(transformComplaint)),
    placeholderData: keepPreviousData,
  });
};

export const useGetComplaintById = (id: string) => {
  return useQuery({
    queryKey: complaintKeys.detail(id),
    queryFn: () => complaintsApi.getById(id).then((r) => transformComplaint(r.data)),
    enabled: !!id,
  });
};
