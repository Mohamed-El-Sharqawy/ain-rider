/**
 * Trip Matched Consumer
 * 
 * Consumes trip_matched events from match-service and updates trip status
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JetStreamConsumer, EventEnvelope, IdempotencyService } from '@ain-rider/nats-client';
import type { JsMsg } from 'nats';
import type { TripMatchedPayload } from '@ain-rider/nats-client';
import { TripsService } from '../trips/trips.service';
import { NatsService } from '../shared/nats/nats.service';

@Injectable()
export class TripMatchedConsumer implements OnModuleInit, OnModuleDestroy {
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
      console.error('[TripMatchedConsumer] NATS connection not available after 5s');
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
        _msg: JsMsg,
        traceId: string
      ): Promise<void> {
        const payload = envelope.data as TripMatchedPayload;
        
        console.log(
          `[TripMatchedConsumer] Processing trip_matched | tripId=${payload.tripId} | driverId=${payload.driverId} | traceId=${traceId}`
        );

        // Update trip status to MATCHED with driver info
        await this.tripsService.updateStatus(
          payload.tripId,
          'MATCHED' as any,
          payload.driverId,
          traceId
        );

        console.log(
          `[TripMatchedConsumer] Updated trip ${payload.tripId} to MATCHED | traceId=${traceId}`
        );
      }
    })(
      this.natsService.nc,
      {
        streamName: 'AIN_RIDER',
        consumerName: 'trip-matched-consumer',
        filterSubject: 'ain_rider.trip_matched',
        maxDeliver: 3,
        enableIdempotency: true,
        enableDLQ: true,
      },
      this.tripsService,
      this.natsService.idempotency
    );

    // Start consuming
    await this.consumer.start();
    console.log('[TripMatchedConsumer] Started');
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.stop();
      console.log('[TripMatchedConsumer] Stopped');
    }
  }
}
