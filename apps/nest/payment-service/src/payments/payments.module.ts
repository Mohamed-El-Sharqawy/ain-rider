import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NatsService } from '../shared/nats/nats.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripCompletedConsumer } from '../consumers/trip-completed.consumer';
import { PaymentRefundResponder } from '../nats/responders/payment-refund.responder';
import { PaymentAdjustResponder } from '../nats/responders/payment-adjust.responder';
import { PaymentEventPublisher } from '../events/payment-event.publisher';
import { InternalAuthGuard } from '../auth/internal-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('INTERNAL_SERVICE_SECRET');
        if (!secret) {
          throw new Error('[PaymentsModule] FATAL: INTERNAL_SERVICE_SECRET is required.');
        }
        return { secret };
      },
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    NatsService,
    PrismaService,
    TripCompletedConsumer,
    PaymentRefundResponder,
    PaymentAdjustResponder,
    PaymentEventPublisher,
    InternalAuthGuard,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
