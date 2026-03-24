/**
 * Trip Completed Consumer
 * 
 * Consumes trip_completed events and creates payment records
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { JetStreamConsumer, EventEnvelope, IdempotencyService } from '@ain-rider/nats-client';
import type { JsMsg } from 'nats';
import type { TripCompletedPayload } from '@ain-rider/nats-client';
import { PaymentsService } from '../payments/payments.service';
import { NatsService } from '../shared/nats/nats.service';

@Injectable()
export class TripCompletedConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: JetStreamConsumer | null = null;

  constructor(
    private paymentsService: PaymentsService,
    private natsService: NatsService,
  ) {}

  async onModuleInit() {
    // Wait for NatsService to be ready (async onModuleInit may not complete before this runs)
    let retries = 0;
    while (!this.natsService.nc && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!this.natsService.nc) {
      console.error('[TripCompletedConsumer] NATS connection not available after 5s');
      return;
    }

    // Create consumer instance
    this.consumer = new (class extends JetStreamConsumer {
      private paymentsService: PaymentsService;

      constructor(
        nc: any,
        config: any,
        paymentsService: PaymentsService,
        idempotency: IdempotencyService
      ) {
        super(nc, config, { idempotencyService: idempotency });
        this.paymentsService = paymentsService;
      }

      async handleMessage(
        envelope: EventEnvelope<unknown>,
        _msg: JsMsg,
        traceId: string
      ): Promise<void> {
        const payload = envelope.data as TripCompletedPayload;
        
        console.log(
          `[TripCompletedConsumer] Processing trip_completed | tripId=${payload.tripId} | fare=${payload.actualFare} | traceId=${traceId}`
        );

        // Create payment record for completed trip
        await this.paymentsService.createPayment({
          tripId: payload.tripId,
          riderId: payload.riderId,
          driverId: payload.driverId,
          amount: payload.actualFare,
          paymentMethod: 'CASH', // Default to CASH, will be updated if different
        });

        console.log(
          `[TripCompletedConsumer] Created payment for trip ${payload.tripId} | traceId=${traceId}`
        );
      }
    })(
      this.natsService.nc,
      {
        streamName: 'AIN_RIDER',
        consumerName: 'trip-completed-consumer',
        filterSubject: 'ain_rider.trip_completed',
        maxDeliver: 3,
        enableIdempotency: true,
        enableDLQ: true,
      },
      this.paymentsService,
      this.natsService.idempotency
    );

    // Start consuming
    await this.consumer.start();
    console.log('[TripCompletedConsumer] Started');
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.stop();
      console.log('[TripCompletedConsumer] Stopped');
    }
  }
}
