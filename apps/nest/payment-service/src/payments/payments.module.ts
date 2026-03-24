import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NatsService } from '../shared/nats/nats.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripCompletedConsumer } from '../consumers/trip-completed.consumer';
import { PaymentRefundResponder } from '../nats/responders/payment-refund.responder';
import { PaymentEventPublisher } from '../events/payment-event.publisher';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    NatsService,
    PrismaService,
    TripCompletedConsumer,
    PaymentRefundResponder,
    PaymentEventPublisher,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
