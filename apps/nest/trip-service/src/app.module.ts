import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from './prisma/prisma.module';
import { NatsModule } from './shared/nats/nats.module';
import { TripsModule } from './trips/trips.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    PrismaModule,
    NatsModule,
    TripsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
