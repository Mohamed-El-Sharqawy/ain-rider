/**
 * Payment Event Publisher
 * 
 * Publishes payment events to NATS JetStream for real-time UI updates and audit.
 */

import { Injectable } from '@nestjs/common';
import { JetStreamPublisher } from '@ain-rider/nats-client';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import { NatsService } from '../shared/nats/nats.service';
import type { Payment } from '../generated/prisma/client';

@Injectable()
export class PaymentEventPublisher {
  private _publisher: JetStreamPublisher | null = null;

  constructor(private nats: NatsService) {}

  private get publisher(): JetStreamPublisher {
    if (!this._publisher) {
      this._publisher = new JetStreamPublisher(this.nats.nc, 'payment-service');
    }
    return this._publisher;
  }

  /**
   * Publish payment_processed event after trip payment is completed
   */
  async publishPaymentProcessed(payment: Payment, traceId: string): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.PAYMENT_PROCESSED,
      'payment_processed',
      {
        paymentId: payment.id,
        tripId: payment.tripId,
        riderId: payment.riderId,
        driverId: payment.driverId,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod as 'CASH' | 'WALLET' | 'CARD',
        status: payment.status as 'COMPLETED' | 'FAILED' | 'REFUNDED',
        processedAt: payment.completedAt?.toISOString() || new Date().toISOString(),
      },
      { traceId },
    );
    console.log(`[PaymentEventPublisher] Published payment_processed | paymentId=${payment.id} | traceId=${traceId}`);
  }

  /**
   * Publish wallet_updated event after wallet balance changes
   */
  async publishWalletUpdated(
    wallet: { id: string; balance: number },
    changeAmount: number,
    changeType: 'CREDIT' | 'DEBIT' | 'ADJUSTMENT',
    reason: string,
    referenceId: string,
    traceId: string
  ): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.WALLET_UPDATED,
      'wallet_updated',
      {
        walletId: wallet.id,
        newBalance: wallet.balance,
        changeAmount,
        changeType,
        reason,
        referenceId,
        timestamp: new Date().toISOString(),
      },
      { traceId },
    );
    console.log(`[PaymentEventPublisher] Published wallet_updated | walletId=${wallet.id} | change=${changeAmount} | traceId=${traceId}`);
  }
}
