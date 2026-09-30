import { useMutation, useQueryClient } from '@tanstack/react-query';
import { walletsApi } from './api';
import { walletKeys } from './queries';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';
import type { CreditDebitDTO, ProcessWithdrawalDTO } from './dto';

export const useCreditWallet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreditDebitDTO) => walletsApi.credit(data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.byUser(userId) });
      toast.success('تمت إضافة الرصيد بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useDebitWallet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreditDebitDTO) => walletsApi.debit(data),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: walletKeys.byUser(userId) });
      toast.success('تم خصم الرصيد بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};

export const useProcessWithdrawal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProcessWithdrawalDTO }) => 
      walletsApi.processWithdrawal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletKeys.all });
      toast.success('تمت معالجة طلب السحب بنجاح');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
};
