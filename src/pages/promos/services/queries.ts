import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { promosApi } from './api';
import { transformPromo } from './transformers';

export const promoKeys = {
  all: ['promos'] as const,
  list: (status?: string) => [...promoKeys.all, 'list', { status }] as const,
  detail: (code: string) => [...promoKeys.all, 'detail', code] as const,
};

export const useGetPromos = (status?: string) => {
  return useQuery({
    queryKey: promoKeys.list(status),
    queryFn: () => promosApi.getAll(status).then((r) => r.data.map(transformPromo)),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetPromoByCode = (code: string) => {
  return useQuery({
    queryKey: promoKeys.detail(code),
    queryFn: () => promosApi.getByCode(code).then((r) => transformPromo(r.data)),
    enabled: !!code,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
