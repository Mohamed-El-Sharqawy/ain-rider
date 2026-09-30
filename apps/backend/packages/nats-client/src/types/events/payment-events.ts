/**
 * Payment Event Payloads
 * 
 * Events for payment processing, wallet updates, withdrawals
 */

// ─────────────────────────────────────────────────────────────────────────────
// Payment Processed - Published by payment-service after trip payment
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentProcessedPayload {
  paymentId: string;
  tripId: string;
  riderId: string;
  driverId: string;
  amount: number;
  currency: string;
  paymentMethod: 'CASH' | 'WALLET' | 'CARD';
  status: 'COMPLETED' | 'FAILED' | 'REFUNDED';
  processedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet Updated - Published when wallet balance changes
// ─────────────────────────────────────────────────────────────────────────────

export interface WalletUpdatedPayload {
  walletId: string;
  userId: string;
  previousBalance: number;
  newBalance: number;
  change: number; // positive for credit, negative for debit
  changeType: 'CREDIT' | 'DEBIT';
  reason: 'TRIP_EARNING' | 'TRIP_PAYMENT' | 'WITHDRAWAL' | 'REFUND' | 'PROMO_CREDIT';
  referenceId?: string | null; // tripId, withdrawalId, etc.
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Requested - Published when driver requests withdrawal
// ─────────────────────────────────────────────────────────────────────────────

export interface WithdrawalRequestedPayload {
  withdrawalId: string;
  driverId: string;
  amount: number;
  bankAccount: string; // masked
  status: 'PENDING';
  requestedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Withdrawal Processed - Published when withdrawal is completed
// ─────────────────────────────────────────────────────────────────────────────

export interface WithdrawalProcessedPayload {
  withdrawalId: string;
  driverId: string;
  amount: number;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  processedBy?: string | null;
  processedAt: string;
  failureReason?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentProcessedEvent = PaymentProcessedPayload;
export type WalletUpdatedEvent = WalletUpdatedPayload;
export type WithdrawalRequestedEvent = WithdrawalRequestedPayload;
export type WithdrawalProcessedEvent = WithdrawalProcessedPayload;
