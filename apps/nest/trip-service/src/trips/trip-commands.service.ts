// ─── Trip Commands Handler ───────────────────────────────────────────────────
// Handles NATS request-reply commands from admin-service.
// Trip-service is the SOLE WRITER to trip_db — admin triggers actions via NATS.

import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../shared/nats/nats.service';
import { TripsService } from './trips.service';
import { NATS_REQUESTS, TripStatus } from '@ain-rider/shared-types';

interface CancelTripRequest {
  tripId: string;
  reason: string;
  cancelledBy: string;
}

interface UpdateStatusRequest {
  tripId: string;
  status: TripStatus;
  driverId?: string;
}

interface AssignDriverRequest {
  tripId: string;
  driverId: string;
}

@Injectable()
export class TripCommandsService implements OnModuleInit {
  constructor(
    private nats: NatsService,
    private tripsService: TripsService,
  ) {}

  async onModuleInit() {
    // Wait for NatsService to be ready
    let retries = 0;
    while (!this.nats.responder && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!this.nats.responder) {
      console.error('[TripCommands] NATS responder not available after 5s');
      return;
    }
    
    await this.registerHandlers();
  }

  private async registerHandlers() {
    // Handle trip cancellation from admin
    await this.nats.responder.respond<CancelTripRequest, any>(
      NATS_REQUESTS.TRIP_CANCEL,
      async (req) => {
        return this.tripsService.cancelTrip(req.tripId, req.reason, req.cancelledBy);
      },
    );

    // Handle status updates from admin
    await this.nats.responder.respond<UpdateStatusRequest, any>(
      NATS_REQUESTS.TRIP_UPDATE_STATUS,
      async (req) => {
        return this.tripsService.updateStatus(req.tripId, req.status, req.driverId);
      },
    );

    // Handle driver assignment from admin
    await this.nats.responder.respond<AssignDriverRequest, any>(
      NATS_REQUESTS.TRIP_ASSIGN_DRIVER,
      async (req) => {
        return this.tripsService.updateStatus(req.tripId, TripStatus.MATCHED, req.driverId);
      },
    );
  }
}
