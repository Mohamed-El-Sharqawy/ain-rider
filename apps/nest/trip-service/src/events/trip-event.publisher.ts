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
  SOSCreatedPayload,
  SOSResolvedPayload,
} from '@ain-rider/nats-client';
import type { Location } from '@ain-rider/nats-client';

export const TRIP_SUBJECTS = {
  TRIP_REQUESTED: 'ain_rider.trip_requested',
  TRIP_MATCHED: 'ain_rider.trip_matched',
  TRIP_STARTED: 'ain_rider.trip_started',
  TRIP_COMPLETED: 'ain_rider.trip_completed',
  TRIP_CANCELLED: 'ain_rider.trip_cancelled',
  TRIP_REJECTED: 'ain_rider.trip_rejected',
  TRIP_NO_MATCH: 'ain_rider.trip_no_match',
  SOS_CREATED: 'ain_rider.sos_created',
  SOS_RESOLVED: 'ain_rider.sos_resolved',
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
   * Publish trip_rejected event when driver rejects a trip
   */
  async publishTripRejected(
    trip: {
      id: string;
      driverId: string;
      riderId: string;
      reason?: string | null;
    },
    traceId?: string
  ): Promise<void> {
    const payload = {
      tripId: trip.id,
      driverId: trip.driverId,
      riderId: trip.riderId,
      reason: trip.reason || 'DRIVER_REJECTED',
      rejectedAt: new Date().toISOString(),
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.TRIP_REJECTED,
      'trip_rejected',
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

  /**
   * Publish sos_created event when SOS is triggered
   */
  async publishSOSCreated(
    data: {
      sosId: string;
      tripId?: string | null;
      userId: string;
      userType: 'RIDER' | 'DRIVER';
      location: Location;
      reason?: string | null;
    },
    traceId?: string
  ): Promise<void> {
    const payload: SOSCreatedPayload = {
      sosId: data.sosId,
      tripId: data.tripId,
      userId: data.userId,
      userType: data.userType,
      location: data.location,
      reason: data.reason,
      createdAt: new Date().toISOString(),
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.SOS_CREATED,
      'sos_created',
      payload,
      { traceId }
    );
  }

  /**
   * Publish sos_resolved event when SOS is resolved
   */
  async publishSOSResolved(
    data: {
      sosId: string;
      resolvedBy: string;
      resolution: 'FALSE_ALARM' | 'RESOLVED' | 'ESCALATED_TO_AUTHORITIES';
      notes?: string | null;
    },
    traceId?: string
  ): Promise<void> {
    const payload: SOSResolvedPayload = {
      sosId: data.sosId,
      resolvedBy: data.resolvedBy,
      resolution: data.resolution,
      notes: data.notes,
      resolvedAt: new Date().toISOString(),
    };

    await this.publisher.publish(
      TRIP_SUBJECTS.SOS_RESOLVED,
      'sos_resolved',
      payload,
      { traceId }
    );
  }
}
