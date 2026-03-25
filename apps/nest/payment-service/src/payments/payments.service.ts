import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentEventPublisher } from '../events/payment-event.publisher';
import { PaymentStatus } from '@ain-rider/shared-types';
import { generateTraceId } from '@ain-rider/nats-client';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private paymentEventPublisher: PaymentEventPublisher,
  ) {}

  async createPayment(data: {
    tripId: string;
    riderId: string;
    driverId: string;
    amount: number;
    paymentMethod: string;
  }) {
    // For CASH payments, create record as PENDING (driver confirms cash collection)
    const payment = await this.prisma.payment.create({
      data: {
        ...data,
        currency: 'IQD',
        status: PaymentStatus.PENDING,
        paymentMethod: 'CASH',
      },
    });

    return payment;
  }

  async confirmCashCollection(paymentId: string, collectedBy: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
        transactionId: `cash_${Date.now()}`,
        gatewayResponse: { collectedBy, method: 'CASH' },
      },
    });

    // Publish payment_processed event
    const traceId = generateTraceId();
    await this.paymentEventPublisher.publishPaymentProcessed(payment, traceId);

    return payment;
  }

  async markPaymentFailed(paymentId: string, reason: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: { failureReason: reason },
      },
    });
  }

  async createRefund(paymentId: string, amount: number, reason: string) {
    const refund = await this.prisma.refund.create({
      data: { paymentId, amount, reason, status: 'PENDING' },
    });
    return refund;
  }

  async adjustPayment(paymentId: string, newAmount: number, reason: string, adjustedBy: string) {
    const existingPayment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    const previousAmount = existingPayment.amount;

    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: newAmount,
        gatewayResponse: {
          ...((existingPayment.gatewayResponse as object) || {}),
          adjustment: {
            previousAmount,
            reason,
            adjustedBy,
            adjustedAt: new Date().toISOString(),
          },
        },
      },
    });

    // Publish wallet_updated event if this affects rider's balance
    const traceId = generateTraceId();
    await this.paymentEventPublisher.publishWalletUpdated(
      { id: payment.riderId, balance: 0 } as any, // Would fetch actual wallet
      previousAmount - newAmount,
      'ADJUSTMENT',
      reason,
      paymentId,
      traceId
    );

    return payment;
  }

  findByTrip(tripId: string) {
    return this.prisma.payment.findUnique({ where: { tripId } });
  }

  findById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }
}
