import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { NATS_SUBJECTS, PaymentStatus } from '@ain-rider/shared-types';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private nats: NatsService,
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

    await this.nats.publisher.publish({
      subject: NATS_SUBJECTS.PAYMENT_PROCESSED,
      data: {
        tripId: payment.tripId,
        paymentId: payment.id,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: 'CASH',
      },
    });

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

  findByTrip(tripId: string) {
    return this.prisma.payment.findUnique({ where: { tripId } });
  }

  findById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }
}
