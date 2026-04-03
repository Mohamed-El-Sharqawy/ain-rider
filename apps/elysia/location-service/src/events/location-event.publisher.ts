/**
 * Location Event Publisher
 * 
 * Publishes location update events to NATS JetStream
 */

import { JetStreamPublisher, generateTraceId, createEventEnvelope } from '@ain-rider/nats-client';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationUpdatePayload {
  driverId: string;
  location: Location;
  heading?: number;
  speed?: number;
  isOnline: boolean;
  h3Index?: string;
}

export const LOCATION_SUBJECTS = {
  LOCATION_UPDATE: 'ain_rider.location_update',
} as const;

export class LocationEventPublisher {
  constructor(private publisher: JetStreamPublisher) { }

  /**
   * Publish location update event when driver GPS updates
   */
  async publishLocationUpdate(
    data: LocationUpdatePayload,
    traceId?: string
  ): Promise<void> {
    const eventId = generateTraceId();
    const resolvedTraceId = traceId ?? eventId;

    const envelope = createEventEnvelope(
      'location_update',
      data,
      {
        eventId,
        traceId: resolvedTraceId,
        source: 'location-service',
      }
    );

    await this.publisher.publish(
      LOCATION_SUBJECTS.LOCATION_UPDATE,
      'location_update',
      envelope,
      { traceId: resolvedTraceId }
    );

    console.log(
      `[LocationEventPublisher] Published location_update | driverId=${data.driverId}`
    );
  }
}
