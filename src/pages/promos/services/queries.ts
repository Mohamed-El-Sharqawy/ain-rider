import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { promosApi } from './api';
import { transformPromo } from './transformers';

export const promoKeys = {
  all: ['promos'] as const,
  list: (status?: string) => ['promos', 'list', { status }] as const,
  detail: (code: string) => ['promos', 'detail', code] as const,
};

export const useGetPromos = (status?: string) => {
  return useQuery({
    queryKey: promoKeys.list(status),
    queryFn: () => promosApi.getAll(status).then((r) => r.data.map(transformPromo)),
    placeholderData: keepPreviousData,
  });
};

export const useGetPromoByCode = (code: string) => {
  return useQuery({
    queryKey: promoKeys.detail(code),
    queryFn: () => promosApi.getByCode(code).then((r) => transformPromo(r.data)),
    enabled: !!code,
  });
};
