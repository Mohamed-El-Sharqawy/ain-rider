export declare enum TransactionType {
    CREDIT = "CREDIT",
    DEBIT = "DEBIT",
    REFUND = "REFUND",
    WITHDRAWAL = "WITHDRAWAL",
    TRIP_PAYMENT = "TRIP_PAYMENT",
    ADMIN_CREDIT = "ADMIN_CREDIT"
}
export declare enum TransactionStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare enum WithdrawalStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED"
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
    referenceId?: string;
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
    processedBy?: string;
    rejectionReason?: string;
    transactionId?: string;
}
//# sourceMappingURL=wallet.types.d.ts.map