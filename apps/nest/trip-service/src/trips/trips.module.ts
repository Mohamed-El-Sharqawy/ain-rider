import { Module, OnModuleInit } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { AdminController } from './admin.controller';
import { TripsService } from './trips.service';
import { TripCommandsService } from './trip-commands.service';
import { NatsService } from '../shared/nats/nats.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripAssignedConsumer } from '../consumers/trip-matched.consumer';
import { TripCancelResponder } from '../nats/responders/trip-cancel.responder';
import { TripAssignDriverResponder } from '../nats/responders/trip-assign-driver.responder';
import { TripCreateResponder } from '../nats/responders/trip-create.responder';
import { TripUpdateStatusResponder } from '../nats/responders/trip-update-status.responder';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('INTERNAL_SERVICE_SECRET'),
      }),
    }),
  ],
  controllers: [TripsController, AdminController],
  providers: [
    TripsService,
    TripCommandsService,
    NatsService,
    PrismaService,
    TripAssignedConsumer,
    TripCancelResponder,
    TripAssignDriverResponder,
    TripCreateResponder,
    TripUpdateStatusResponder,
  ],
  exports: [TripsService],
})
export class TripsModule implements OnModuleInit {
  constructor(private tripsService: TripsService) {}

  onModuleInit() {
    // Initialize event publisher with NATS connection
    this.tripsService.initEventPublisher();
  }
}
