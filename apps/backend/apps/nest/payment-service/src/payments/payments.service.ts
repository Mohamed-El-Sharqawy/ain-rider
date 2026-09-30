import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentEventPublisher } from '../events/payment-event.publisher';
import { PaymentStatus } from '@ain-rider/shared-types';
import { generateTraceId } from '@ain-rider/nats-client';

interface CashGatewayResponse {
  collectedBy: string;
  method: 'CASH';
  collectedAt: string;
}

interface CashFailureResponse {
  failureReason: string;
  failedAt: string;
}

interface AdjustmentEntry {
  previousAmount: number;
  reason: string;
  adjustedBy: string;
  adjustedAt: string;
}

type GatewayResponse = CashGatewayResponse | CashFailureResponse | Record<string, unknown>;

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
    const existing = await this.prisma.payment.findUnique({ where: { tripId: data.tripId } });
    if (existing) {
      return existing;
    }

    const payment = await this.prisma.payment.create({
      data: {
        ...data,
        currency: process.env.CURRENCY || 'IQD',
        status: PaymentStatus.PENDING,
        paymentMethod: 'CASH',
      },
    });

    return payment;
  }

  async confirmCashCollection(paymentId: string, collectedBy: string) {
    const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) {
      throw new BadRequestException(`Payment ${paymentId} not found`);
    }
    if (existing.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is not in PENDING status (current: ${existing.status})`);
    }

    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        completedAt: new Date(),
        transactionId: `cash_${Date.now()}`,
        gatewayResponse: { collectedBy, method: 'CASH', collectedAt: new Date().toISOString() } satisfies CashGatewayResponse,
      },
    });

    const traceId = generateTraceId();
    await this.paymentEventPublisher.publishPaymentProcessed(payment, traceId);

    return payment;
  }

  async markPaymentFailed(paymentId: string, reason: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: { failureReason: reason, failedAt: new Date().toISOString() } satisfies CashFailureResponse,
      },
    });
  }

  async createRefund(paymentId: string, amount: number, reason: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new BadRequestException(`Payment ${paymentId} not found`);
    }

    const totalRefunded = payment.refunds.reduce((sum, r) => sum + (r.status !== 'REJECTED' ? r.amount : 0), 0);
    if (totalRefunded + amount > payment.amount) {
      throw new BadRequestException(
        `Refund amount ${amount} exceeds remaining. Total: ${payment.amount}, Already refunded: ${totalRefunded}`,
      );
    }

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
          ...((existingPayment.gatewayResponse as GatewayResponse) || {}),
          adjustment: {
            previousAmount,
            reason,
            adjustedBy,
            adjustedAt: new Date().toISOString(),
          } satisfies AdjustmentEntry,
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
