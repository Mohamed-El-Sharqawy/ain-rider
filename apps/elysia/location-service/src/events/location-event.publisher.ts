/**
 * Location Event Publisher
 * 
 * Publishes location update events to NATS JetStream
 */

import { JetStreamPublisher, generateTraceId } from '@ain-rider/nats-client';

export interface LocationUpdatePayload {
  driverId: string;
  location: {
    lat: number;
    lng: number;
  };
  heading?: number;
  speed?: number;
  isOnline: boolean;
  h3Index?: string;
  timestamp: string; // ISO string
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
    const resolvedTraceId = traceId ?? generateTraceId();

    // Pass raw data — publisher.publish() wraps it in an EventEnvelope automatically
    await this.publisher.publish(
      LOCATION_SUBJECTS.LOCATION_UPDATE,
      'location_update',
      data,
      { traceId: resolvedTraceId }
    );

    console.log(
      `[LocationEventPublisher] Published location_update | driverId=${data.driverId}`
    );
  }
}
