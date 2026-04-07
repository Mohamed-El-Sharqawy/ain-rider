import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsModule } from '@ain-rider/metrics';
import { PrismaModule } from './prisma/prisma.module';
import { NatsModule } from './shared/nats/nats.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MetricsModule.forRoot({ serviceName: 'payment-service' }),
    TerminusModule,
    PrismaModule,
    NatsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
