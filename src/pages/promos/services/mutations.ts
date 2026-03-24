import { useMutation, useQueryClient } from '@tanstack/react-query';
import { promosApi } from './api';
import { promoKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { CreatePromoDTO, UpdatePromoDTO } from './dto';

export const useCreatePromo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePromoDTO) => promosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promoKeys.all });
      toast.success('تم إنشاء العرض الترويجي بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useUpdatePromo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePromoDTO }) =>
      promosApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: promoKeys.all });
      queryClient.invalidateQueries({ queryKey: promoKeys.detail(id) });
      toast.success('تم تحديث العرض الترويجي بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};
