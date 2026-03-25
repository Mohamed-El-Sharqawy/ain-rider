import { Module, OnModuleInit } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripCommandsService } from './trip-commands.service';
import { NatsService } from '../shared/nats/nats.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripMatchedConsumer } from '../consumers/trip-matched.consumer';
import { TripCancelResponder } from '../nats/responders/trip-cancel.responder';
import { TripAssignDriverResponder } from '../nats/responders/trip-assign-driver.responder';
import { TripCreateResponder } from '../nats/responders/trip-create.responder';
import { TripUpdateStatusResponder } from '../nats/responders/trip-update-status.responder';

@Module({
  controllers: [TripsController],
  providers: [
    TripsService,
    TripCommandsService,
    NatsService,
    PrismaService,
    TripMatchedConsumer,
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
