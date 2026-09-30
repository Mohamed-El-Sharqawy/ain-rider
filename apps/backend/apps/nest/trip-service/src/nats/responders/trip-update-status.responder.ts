/**
 * Trip Update Status Responder
 * 
 * Handles trip.update_status.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { TripsService } from '../../trips/trips.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface UpdateTripStatusRequest {
  tripId: string;
  status: string;
  driverId?: string;
  reason?: string;
  traceId?: string;
}

export interface UpdateTripStatusResponse {
  tripId: string;
  previousStatus: string;
  newStatus: string;
}

@Injectable()
export class TripUpdateStatusResponder implements OnModuleInit, OnModuleDestroy {
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
      console.error('[TripUpdateStatusResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<UpdateTripStatusRequest, UpdateTripStatusResponse>(
      'trip.update_status.request',
      async (request) => {
        const { tripId, status, driverId, traceId } = request;

        console.log(
          `[TripUpdateStatusResponder] Processing status update | tripId=${tripId} | status=${status} | traceId=${traceId}`
        );

        // Update trip status
        const trip = await this.tripsService.updateStatus(
          tripId,
          status as any,
          driverId,
          traceId
        );

        console.log(
          `[TripUpdateStatusResponder] Status updated | tripId=${tripId} | newStatus=${trip.status} | traceId=${traceId}`
        );

        return {
          tripId: trip.id,
          previousStatus: trip.status, // This would need previous status tracking
          newStatus: trip.status,
        };
      }
    );

    console.log('[TripUpdateStatusResponder] Started listening on trip.update_status.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[TripUpdateStatusResponder] Stopped');
  }
}
