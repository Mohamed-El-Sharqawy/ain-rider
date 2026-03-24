/**
 * Trip Event Publisher
 * 
 * Publishes trip lifecycle events to NATS JetStream with proper envelopes
 */

import { Injectable } from '@nestjs/common';
import { JetStreamPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import {
  TripRequestedPayload,
  TripStartedPayload,
  TripCompletedPayload,
  TripCancelledPayload,
} from '@ain-rider/nats-client';

export const TRIP_SUBJECTS = {
  TRIP_REQUESTED: 'ain_rider.trip_requested',
  TRIP_MATCHED: 'ain_rider.trip_matched',
  TRIP_STARTED: 'ain_rider.trip_started',
  TRIP_COMPLETED: 'ain_rider.trip_completed',
  TRIP_CANCELLED: 'ain_rider.trip_cancelled',
  TRIP_NO_MATCH: 'ain_rider.trip_no_match',
} as const;

@Injectable()
export class TripEventPublisher {
  private publisher: JetStreamPublisher;

  constructor() {
    // Publisher will be initialized with connection in onModuleInit
  }

  /**
   * Initialize publisher with NATS connection
   */
  init(nc: NatsConnection): void {
    this.publisher = new JetStreamPublisher(nc, 'trip-service');
  }

  /**
   * Publish trip_requested event when rider requests a trip
   */
  async publishTripRequested(
    trip: {
      id: string;
      riderId: string;
      pickupLat: number;
      pickupLng: number;
      dropoffLat: number;
      dropoffLng: number;
      pickupAddress: string;
      dropoffAddress: string;
      estimatedFare: number;
      paymentMethod: string;
      promoCode?: string | null;
      requestedAt: Date;
    },
    traceId?: string
  ): Promise<void> {
    const payload: TripRequestedPayload = {
      tripId: trip.id,
      riderId: trip.riderId,
      pickupLocation: { lat: trip.pickupLat, lng: trip.pickupLng },
      dropoffLocation: { lat: trip.dropoffLat, lng: trip.dropoffLng },
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress,
      estimatedFare: trip.estimatedFare,
      paymentMethod: trip.paymentMethod,
      promoCode: trip.promoCode,
      requestedAt: trip.requestedAt.toISOString(),
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.TRIP_REQUESTED,
      'trip_requested',
      payload,
      { traceId }
    );
  }

  /**
   * Publish trip_started event when ride begins
   */
  async publishTripStarted(
    trip: {
      id: string;
      driverId: string;
      riderId: string;
      pickupLat: number;
      pickupLng: number;
      startedAt?: Date | null;
    },
    traceId?: string
  ): Promise<void> {
    const payload: TripStartedPayload = {
      tripId: trip.id,
      driverId: trip.driverId,
      riderId: trip.riderId,
      startedAt: trip.startedAt?.toISOString() ?? new Date().toISOString(),
      pickupLocation: { lat: trip.pickupLat, lng: trip.pickupLng },
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.TRIP_STARTED,
      'trip_started',
      payload,
      { traceId }
    );
  }

  /**
   * Publish trip_completed event when ride ends
   */
  async publishTripCompleted(
    trip: {
      id: string;
      driverId: string;
      riderId: string;
      actualFare: number;
      distance?: number | null;
      duration?: number | null;
      pickupLat: number;
      pickupLng: number;
      dropoffLat: number;
      dropoffLng: number;
      completedAt?: Date | null;
    },
    traceId?: string
  ): Promise<void> {
    const payload: TripCompletedPayload = {
      tripId: trip.id,
      driverId: trip.driverId,
      riderId: trip.riderId,
      actualFare: trip.actualFare,
      distance: trip.distance ?? 0,
      duration: trip.duration ?? 0,
      completedAt: trip.completedAt?.toISOString() ?? new Date().toISOString(),
      pickupLocation: { lat: trip.pickupLat, lng: trip.pickupLng },
      dropoffLocation: { lat: trip.dropoffLat, lng: trip.dropoffLng },
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.TRIP_COMPLETED,
      'trip_completed',
      payload,
      { traceId }
    );
  }

  /**
   * Publish trip_cancelled event when trip is cancelled
   */
  async publishTripCancelled(
    trip: {
      id: string;
      driverId?: string | null;
      riderId: string;
      cancellationReason?: string | null;
      cancelledBy?: string | null;
      cancelledAt?: Date | null;
    },
    cancelledBy: 'RIDER' | 'DRIVER' | 'SYSTEM' | string,
    reason: string,
    traceId?: string
  ): Promise<void> {
    const payload: TripCancelledPayload = {
      tripId: trip.id,
      driverId: trip.driverId,
      riderId: trip.riderId,
      cancelledBy: cancelledBy as 'RIDER' | 'DRIVER' | 'SYSTEM',
      cancellationReason: reason,
      cancelledAt: trip.cancelledAt?.toISOString() ?? new Date().toISOString(),
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.TRIP_CANCELLED,
      'trip_cancelled',
      payload,
      { traceId }
    );
  }

  /**
   * Publish trip_matched event (when match-service notifies)
   * This is typically called by the trip-matched consumer
   */
  async publishTripMatched(
    data: {
      tripId: string;
      driverId: string;
      driverName: string;
      driverPhone: string;
      driverRating: number;
      vehicleMake: string;
      vehicleModel: string;
      vehiclePlate: string;
      estimatedArrival: number;
      distance: number;
    },
    traceId?: string
  ): Promise<void> {
    await this.publisher.publish(
      TRIP_SUBJECTS.TRIP_MATCHED,
      'trip_matched',
      {
        ...data,
        matchedAt: new Date().toISOString(),
      },
      { traceId }
    );
  }
}
