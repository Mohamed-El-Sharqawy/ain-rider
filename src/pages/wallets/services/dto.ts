export interface WalletDTO {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransactionDTO {
  id: string;
  walletId: string;
  type: string;
  amount: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface WithdrawalDTO {
  id: string;
  userId: string;
  amount: number;
  status: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  };
  processedBy?: string;
  processedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditDebitDTO {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
}

export interface ProcessWithdrawalDTO {
  approve: boolean;
  rejectionReason?: string;
}
