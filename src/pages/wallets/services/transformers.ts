import type { WalletDTO, WithdrawalDTO } from './dto';

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  status: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  processedBy?: string;
  processedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function transformWallet(dto: WalletDTO): Wallet {
  return {
    id: dto.id,
    userId: dto.userId,
    balance: dto.balance,
    currency: dto.currency,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function transformWithdrawal(dto: WithdrawalDTO): Withdrawal {
  return {
    id: dto.id,
    userId: dto.userId,
    amount: dto.amount,
    status: dto.status,
    accountName: dto.bankDetails.accountName,
    accountNumber: dto.bankDetails.accountNumber,
    bankName: dto.bankDetails.bankName,
    processedBy: dto.processedBy,
    processedAt: dto.processedAt,
    rejectionReason: dto.rejectionReason,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
