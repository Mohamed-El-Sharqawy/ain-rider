export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  REFUND = 'REFUND',
  WITHDRAWAL = 'WITHDRAWAL',
  TRIP_PAYMENT = 'TRIP_PAYMENT',
  ADMIN_CREDIT = 'ADMIN_CREDIT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  description: string;
  referenceId?: string; // Trip ID, Withdrawal ID, etc.
  createdAt: Date;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  status: WithdrawalStatus;
  bankAccountNumber: string;
  bankName: string;
  accountHolderName: string;
  requestedAt: Date;
  processedAt?: Date;
  processedBy?: string; // Admin user ID
  rejectionReason?: string;
  transactionId?: string;
}
