/**
 * Trip Cancel Responder
 * 
 * Handles trip.cancel.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { TripsService } from '../../trips/trips.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface CancelTripRequest {
  tripId: string;
  reason: string;
  cancelledBy: string;
}

export interface CancelTripResponse {
  tripId: string;
  newStatus: string;
  cancellationFee?: number;
}

@Injectable()
export class TripCancelResponder implements OnModuleInit, OnModuleDestroy {
  private responder: NatsResponder;

  constructor(
    private tripsService: TripsService,
    private natsService: NatsService,
  ) {}

  async onModuleInit() {
    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<CancelTripRequest, CancelTripResponse>(
      'trip.cancel.request',
      async (request) => {
        const { tripId, reason, cancelledBy } = request;

        console.log(
          `[TripCancelResponder] Processing cancel request | tripId=${tripId} | reason=${reason}`
        );

        // Cancel the trip
        const trip = await this.tripsService.cancelTrip(tripId, reason, cancelledBy);

        console.log(
          `[TripCancelResponder] Trip cancelled | tripId=${tripId} | cancelledBy=${cancelledBy}`
        );

        return {
          tripId: trip.id,
          newStatus: trip.status,
        };
      }
    );

    console.log('[TripCancelResponder] Started listening on trip.cancel.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[TripCancelResponder] Stopped');
  }
}
