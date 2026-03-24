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
    await this.registerHandlers();
  }

  private async registerHandlers() {
    // Handle trip cancellation from admin
    await this.nats.responder.respond<CancelTripRequest, any>(
      NATS_REQUESTS.TRIP_CANCEL,
      async (req) => {
        console.log(`[TripCommands] Cancel request for trip ${req.tripId}`);
        return this.tripsService.cancelTrip(req.tripId, req.reason, req.cancelledBy);
      },
    );

    // Handle status updates from admin
    await this.nats.responder.respond<UpdateStatusRequest, any>(
      NATS_REQUESTS.TRIP_UPDATE_STATUS,
      async (req) => {
        console.log(`[TripCommands] Status update for trip ${req.tripId} -> ${req.status}`);
        return this.tripsService.updateStatus(req.tripId, req.status, req.driverId);
      },
    );

    // Handle driver assignment from admin
    await this.nats.responder.respond<AssignDriverRequest, any>(
      NATS_REQUESTS.TRIP_ASSIGN_DRIVER,
      async (req) => {
        console.log(`[TripCommands] Assign driver ${req.driverId} to trip ${req.tripId}`);
        return this.tripsService.updateStatus(req.tripId, TripStatus.MATCHED, req.driverId);
      },
    );

    console.log('[TripCommands] All command handlers registered');
  }
}
