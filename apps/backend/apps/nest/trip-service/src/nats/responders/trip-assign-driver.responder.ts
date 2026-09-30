/**
 * Trip Assign Driver Responder
 * 
 * Handles trip.assign_driver.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { TripsService } from '../../trips/trips.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface AssignDriverRequest {
  tripId: string;
  driverId: string;
  assignedBy: string;
}

export interface AssignDriverResponse {
  tripId: string;
  driverId: string;
}

@Injectable()
export class TripAssignDriverResponder implements OnModuleInit, OnModuleDestroy {
  private responder: NatsResponder;

  constructor(
    private tripsService: TripsService,
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
      console.error('[TripAssignDriverResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<AssignDriverRequest, AssignDriverResponse>(
      'trip.assign_driver.request',
      async (request) => {
        const { tripId, driverId, assignedBy } = request;

        console.log(
          `[TripAssignDriverResponder] Processing assign request | tripId=${tripId} | driverId=${driverId}`
        );

        // Assign driver to trip
        await this.tripsService.assignDriver(tripId, driverId, assignedBy);

        console.log(
          `[TripAssignDriverResponder] Driver assigned | tripId=${tripId} | driverId=${driverId}`
        );

        return {
          tripId,
          driverId,
        };
      }
    );

    console.log('[TripAssignDriverResponder] Started listening on trip.assign_driver.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[TripAssignDriverResponder] Stopped');
  }
}
