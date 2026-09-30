import { useMutation, useQueryClient } from '@tanstack/react-query';
import { promosApi } from './api';
import { promoKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { CreatePromoDTO, UpdatePromoDTO } from './dto';
import type { Promo } from './transformers';

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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: promoKeys.all });

      const previousLists = queryClient.getQueriesData<Promo[]>({ queryKey: promoKeys.all });

      queryClient.setQueriesData<Promo[]>({ queryKey: promoKeys.all }, (old) => {
        if (!old) return old;
        return old.map((p) =>
          p.id === id
            ? { ...p, ...data, updatedAt: new Date().toISOString() }
            : p
        );
      });

      return { previousLists };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: promoKeys.all });
      queryClient.invalidateQueries({ queryKey: promoKeys.detail(id) });
      toast.success('تم تحديث العرض الترويجي بنجاح');
    },
    onError: (err, _vars, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(getApiError(err));
    },
  });
};
