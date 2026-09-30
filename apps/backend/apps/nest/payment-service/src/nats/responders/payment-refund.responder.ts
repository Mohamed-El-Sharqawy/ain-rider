/**
 * Payment Refund Responder
 * 
 * Handles payment.refund.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { PaymentsService } from '../../payments/payments.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  requestedBy: string;
}

export interface RefundResponse {
  refundId: string;
  amount: number;
}

@Injectable()
export class PaymentRefundResponder implements OnModuleInit, OnModuleDestroy {
  private responder: NatsResponder;

  constructor(
    private paymentsService: PaymentsService,
    private natsService: NatsService,
  ) {}

  async onModuleInit() {
    // Wait for NatsService to be ready
    let retries = 0;
    while (!this.natsService.nc && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!this.natsService.nc) {
      console.error('[PaymentRefundResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<RefundRequest, RefundResponse>(
      'payment.refund.request',
      async (request) => {
        const { paymentId, amount, reason, requestedBy } = request;

        console.log(
          `[PaymentRefundResponder] Processing refund request | paymentId=${paymentId} | amount=${amount}`
        );

        // Create refund record
        const refund = await this.paymentsService.createRefund(paymentId, amount, reason);

        console.log(
          `[PaymentRefundResponder] Refund created | refundId=${refund.id} | requestedBy=${requestedBy}`
        );

        return {
          refundId: refund.id,
          amount: refund.amount,
        };
      }
    );

    console.log('[PaymentRefundResponder] Started listening on payment.refund.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[PaymentRefundResponder] Stopped');
  }
}
