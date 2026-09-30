import { api } from '@/api/client';
import type { WalletDTO, WithdrawalDTO, CreditDebitDTO, ProcessWithdrawalDTO } from './dto';

export const walletsApi = {
  getByUser: (userId: string) =>
    api.get<WalletDTO>(`/admin/wallets/user/${userId}`),

  credit: (data: CreditDebitDTO) =>
    api.post<WalletDTO>('/admin/wallets/credit', data),

  debit: (data: CreditDebitDTO) =>
    api.post<WalletDTO>('/admin/wallets/debit', data),

  getWithdrawals: (status?: string) =>
    api.get<WithdrawalDTO[]>('/admin/withdrawals', { params: { status } }),

  processWithdrawal: (id: string, data: ProcessWithdrawalDTO) =>
    api.patch<WithdrawalDTO>(`/admin/withdrawals/${id}/process`, data),
};
