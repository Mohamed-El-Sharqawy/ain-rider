import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { walletsApi } from './api';
import { transformWallet, transformWithdrawal } from './transformers';

export const walletKeys = {
  all: ['wallets'] as const,
  byUser: (userId: string) => [...walletKeys.all, 'user', userId] as const,
  withdrawals: (status?: string) => [...walletKeys.all, 'withdrawals', { status }] as const,
};

export const useGetWalletByUser = (userId: string) => {
  return useQuery({
    queryKey: walletKeys.byUser(userId),
    queryFn: () => walletsApi.getByUser(userId).then((r) => transformWallet(r.data)),
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};

export const useGetWithdrawals = (status?: string) => {
  return useQuery({
    queryKey: walletKeys.withdrawals(status),
    queryFn: () => walletsApi.getWithdrawals(status).then((r) => r.data.map(transformWithdrawal)),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
