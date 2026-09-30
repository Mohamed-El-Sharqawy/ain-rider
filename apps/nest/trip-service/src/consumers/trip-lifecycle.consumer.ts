/**
 * Trip Lifecycle Consumer
 * 
 * Consumes trip lifecycle events from match-service and other services 
 * to update status in the database.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JetStreamConsumer, EventEnvelope, IdempotencyService } from '@ain-rider/nats-client';
import type { JsMsg } from 'nats';
import type { TripMatchedPayload } from '@ain-rider/nats-client';
import { TripStatus } from '@ain-rider/shared-types';
import { TripsService } from '../trips/trips.service';
import { NatsService } from '../shared/nats/nats.service';

@Injectable()
export class TripLifecycleConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: JetStreamConsumer | null = null;

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
      console.error('[TripLifecycleConsumer] NATS connection not available after 5s');
      return;
    }

    // Create consumer instance
    this.consumer = new (class extends JetStreamConsumer {
      private tripsService: TripsService;

      constructor(
        nc: any,
        config: any,
        tripsService: TripsService,
        idempotency: IdempotencyService
      ) {
        super(nc, config, { idempotencyService: idempotency });
        this.tripsService = tripsService;
      }

      async handleMessage(
        envelope: EventEnvelope<unknown>,
        msg: JsMsg,
        traceId: string
      ): Promise<void> {
        const payload = envelope.data as TripMatchedPayload;
        const subject = msg.subject;

        if (!payload?.tripId) {
          console.error(`[TripLifecycleConsumer] Invalid payload: missing tripId | traceId=${traceId}`);
          return;
        }

        let targetStatus: TripStatus | null = null;
        if (subject.endsWith('trip_assigned')) {
          targetStatus = TripStatus.ASSIGNED;
        } else if (subject.endsWith('trip_matched')) {
          targetStatus = TripStatus.MATCHED;
        }

        if (!targetStatus) {
            return; // Ignore other events
        }

        console.log(
          `[TripLifecycleConsumer] Processing ${subject} | tripId=${payload.tripId} | targetStatus=${targetStatus} | traceId=${traceId}`
        );

        try {
          await this.tripsService.updateStatus(
            payload.tripId,
            targetStatus,
            payload.driverId,
            traceId,
            {
              driverName: payload.driverName,
              driverPhone: payload.driverPhone,
              driverRating: payload.driverRating,
              vehicleMake: payload.vehicleMake,
              vehicleModel: payload.vehicleModel,
              vehiclePlate: payload.vehiclePlate,
            }
          );
        } catch (error) {
          console.error(
            `[TripLifecycleConsumer] Failed to update trip status | tripId=${payload.tripId} | traceId=${traceId}`,
            error
          );
          throw error;
        }
      }
    })(
      this.natsService.nc,
      {
        streamName: 'AIN_RIDER_OPS',
        consumerName: 'trip-lifecycle-consumer',
        serviceName: 'trip-service',
        filterSubject: 'ain_rider.trip_*',
        maxDeliver: 3,
        enableIdempotency: true,
        enableDLQ: true,
      },
      this.tripsService,
      this.natsService.idempotency
    );

    // Start consuming
    await this.consumer.start();
    console.log('[TripLifecycleConsumer] Started');
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.stop();
      console.log('[TripLifecycleConsumer] Stopped');
    }
  }
}
