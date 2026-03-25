/**
 * Trip Create Responder
 * 
 * Handles trip.create.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { TripsService } from '../../trips/trips.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface CreateTripRequest {
  riderId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  estimatedFare: number;
  paymentMethod?: string;
  promoCode?: string;
  traceId?: string;
}

export interface CreateTripResponse {
  tripId: string;
  status: string;
  estimatedFare: number;
}

@Injectable()
export class TripCreateResponder implements OnModuleInit, OnModuleDestroy {
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
      console.error('[TripCreateResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<CreateTripRequest, CreateTripResponse>(
      'trip.create.request',
      async (request) => {
        const { riderId, pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress, estimatedFare, paymentMethod, promoCode, traceId } = request;

        console.log(
          `[TripCreateResponder] Processing create request | riderId=${riderId} | traceId=${traceId}`
        );

        // Create the trip
        const trip = await this.tripsService.createTrip({
          riderId,
          pickupLat,
          pickupLng,
          pickupAddress,
          dropoffLat,
          dropoffLng,
          dropoffAddress,
          estimatedFare,
          paymentMethod,
          promoCode,
        }, traceId);

        console.log(
          `[TripCreateResponder] Trip created | tripId=${trip.id} | traceId=${traceId}`
        );

        return {
          tripId: trip.id,
          status: trip.status,
          estimatedFare: trip.estimatedFare,
        };
      }
    );

    console.log('[TripCreateResponder] Started listening on trip.create.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[TripCreateResponder] Stopped');
  }
}
