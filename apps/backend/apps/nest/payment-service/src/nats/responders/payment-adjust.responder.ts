/**
 * Payment Adjust Responder
 * 
 * Handles payment.adjust.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { PaymentsService } from '../../payments/payments.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface AdjustPaymentRequest {
  paymentId: string;
  amount: number;
  reason: string;
  requestedBy: string;
  traceId?: string;
}

export interface AdjustPaymentResponse {
  paymentId: string;
  previousAmount: number;
  newAmount: number;
  adjustmentReason: string;
}

@Injectable()
export class PaymentAdjustResponder implements OnModuleInit, OnModuleDestroy {
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
      console.error('[PaymentAdjustResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<AdjustPaymentRequest, AdjustPaymentResponse>(
      'payment.adjust.request',
      async (request) => {
        const { paymentId, amount, reason, requestedBy, traceId } = request;

        console.log(
          `[PaymentAdjustResponder] Processing adjust request | paymentId=${paymentId} | amount=${amount} | traceId=${traceId}`
        );

        // Adjust the payment
        const payment = await this.paymentsService.adjustPayment(
          paymentId,
          amount,
          reason,
          requestedBy
        );

        console.log(
          `[PaymentAdjustResponder] Payment adjusted | paymentId=${paymentId} | newAmount=${payment.amount} | traceId=${traceId}`
        );

        return {
          paymentId: payment.id,
          previousAmount: payment.amount, // Would need previous amount tracking
          newAmount: payment.amount,
          adjustmentReason: reason,
        };
      }
    );

    console.log('[PaymentAdjustResponder] Started listening on payment.adjust.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[PaymentAdjustResponder] Stopped');
  }
}
