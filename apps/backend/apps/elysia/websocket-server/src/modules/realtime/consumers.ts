/**
 * WebSocket Server NATS Consumers
 * 
 * Consumers for forwarding NATS JetStream events to WebSocket clients.
 * Uses JetStreamConsumer base class for proper ack/nak handling and DLQ support.
 */

import {
  createNatsConnection,
  JetStreamConsumer,
  EventEnvelope,
  IdempotencyService,
} from '@ain-rider/nats-client';
import type { NatsConnection, JsMsg } from '@ain-rider/nats-client';
import type { TripMatchedPayload } from '@ain-rider/nats-client';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { LocationUpdate } from '@ain-rider/shared-types';
import { ConnectionStore } from '../../shared/connections';
import { redisCluster } from '../../shared/redis';
import { natsEventsTotal, wsConnectionsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

// OSRM_URL from environment
const NATS_SERVERS = process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'];
const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5000';

let nc: NatsConnection;
let idempotency: IdempotencyService;
const consumers: JetStreamConsumer[] = [];

/**
 * Location Update Consumer
 */
class LocationUpdateConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-location',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.LOCATION_UPDATE,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as LocationUpdate;
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.LOCATION_UPDATE });

    try {
      // ── NEW: Real-time OSRM Enrichment ──
      const targetKey = `driver:trip:target:${data.driverId}`;
      const targetJson = await redisCluster.get(targetKey);

      if (targetJson) {
        const target = JSON.parse(targetJson);
        const cacheKey = `driver:osrm:cache:${data.driverId}`;
        const cached = await redisCluster.get(cacheKey);

        let osrmResult = cached ? JSON.parse(cached) : null;

        // Refresh OSRM if no cache or if it's older than 10s
        const lastRefresh = await redisCluster.get(`driver:osrm:refresh:${data.driverId}`);
        if (!osrmResult || !lastRefresh) {
          try {
            const res = await fetch(`${OSRM_URL}/route/v1/driving/${data.location.longitude},${data.location.latitude};${target.lng},${target.lat}?overview=false`);
            if (res.ok) {
              const osrmData = await res.json() as any;
              if (osrmData.routes?.[0]) {
                osrmResult = {
                  distanceMeters: Math.round(osrmData.routes[0].distance),
                  durationSeconds: Math.round(osrmData.routes[0].duration),
                };
                await redisCluster.set(cacheKey, JSON.stringify(osrmResult), 'EX', 60);
                await redisCluster.set(`driver:osrm:refresh:${data.driverId}`, '1', 'EX', 10);
              }
            }
          } catch (e) {
            log('warn', 'OSRM fetch failed in WS consumer', { driverId: data.driverId, error: String(e) });
          }
        }

        if (osrmResult) {
          data.distanceMeters = osrmResult.distanceMeters;
          data.durationSeconds = osrmResult.durationSeconds;
        }
      }
    } catch (e) {
      log('error', 'Failed to enrich location update with OSRM', { driverId: data.driverId, error: String(e) });
    }

    // Send to driver's own connection
    ConnectionStore.send(`driver:${data.driverId}`, {
      type: 'location_update',
      data,
    });

    // Notify any rider watching this driver (Global State Sync)
    try {
      const activeTripKey = `driver:active_trip:${data.driverId}`;
      const activeTripId = await redisCluster.get(activeTripKey);
      log('warn', 'LocationUpdate: active_trip lookup', {
        driverId: data.driverId,
        activeTripKey,
        activeTripId: activeTripId ?? '<none>',
      });
      if (activeTripId) {
        const sent = ConnectionStore.send(`trip:${activeTripId}:rider`, {
          type: 'driver_location_update',
          data,
        });
        log('warn', 'LocationUpdate: forwarded to rider', {
          driverId: data.driverId,
          tripId: activeTripId,
          sent,
        });
      }
    } catch (e) {
      log('error', 'Failed to notify watcher via Redis active_trip', { driverId: data.driverId, error: String(e) });
    }
  }
}

/**
 * Trip Assigned Consumer (from match-service)
 * Forwards assignment to DRIVER ONLY.
 */
class TripAssignedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-trip-assigned',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.TRIP_ASSIGNED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as TripMatchedPayload;
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_ASSIGNED });

    // ONLY notify driver for assignment
    const sent = ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_assigned', data });
    log('info', 'Trip assigned forwarded to driver', { tripId: data.tripId, driverId: data.driverId, sent });
  }
}

/**
 * Trip Matched Consumer (from trip-service)
 * Forwards confirmation to RIDER.
 */
class TripMatchedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-trip-matched',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.TRIP_MATCHED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as TripMatchedPayload;
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_MATCHED });

    // Notify rider that trip is MATCHED
    const riderSent = ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_matched', data });
    log('info', 'Trip matched forwarded to rider', { tripId: data.tripId, driverId: data.driverId, riderSent });

    // Track destination for real-time OSRM (matched phase -> pickup)
    if (data.pickupLocation) {
      const target = { lat: data.pickupLocation.lat, lng: data.pickupLocation.lng, type: 'pickup' };
      await redisCluster.set(`driver:trip:target:${data.driverId}`, JSON.stringify(target), 'EX', 7200);
      log('info', 'TripMatched: set OSRM target for driver', { driverId: data.driverId, target });
    }

    // Add rider as watcher of this driver via Redis
    await redisCluster.set(`driver:active_trip:${data.driverId}`, data.tripId, 'EX', 7200);
    log('info', 'TripMatched: set active_trip key', { driverId: data.driverId, tripId: data.tripId });
  }
}

/**
 * Trip Started Consumer
 */
class TripStartedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-trip-started',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.TRIP_STARTED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { tripId: string; driverId: string; dropoffLocation?: { lat: number, lng: number } };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_STARTED });

    // Track destination for real-time OSRM (in_progress phase -> dropoff)
    if (data.dropoffLocation) {
      const target = { lat: data.dropoffLocation.lat, lng: data.dropoffLocation.lng, type: 'dropoff' };
      await redisCluster.set(`driver:trip:target:${data.driverId}`, JSON.stringify(target), 'EX', 7200);
    }

    ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_started', data });
    ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_started', data });
  }
}

/**
 * Trip Completed Consumer
 */
class TripCompletedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-trip-completed',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.TRIP_COMPLETED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { tripId: string; driverId: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_COMPLETED });

    // Clean up all driver-specific Redis keys for this trip
    await redisCluster.del(`driver:active_trip:${data.driverId}`);
    await redisCluster.del(`driver:trip:target:${data.driverId}`);
    await redisCluster.del(`driver:osrm:cache:${data.driverId}`);
    await redisCluster.del(`driver:osrm:refresh:${data.driverId}`);

    ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_completed', data });
    ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_completed', data });
    log('info', 'Trip completed: cleaned up Redis keys and notified clients', { tripId: data.tripId, driverId: data.driverId });
  }
}

/**
 * Notification Consumer
 */
class NotificationConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-notification',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.NOTIFICATION_SENT,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { userId: string; title: string; body: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.NOTIFICATION_SENT });

    ConnectionStore.send(`user:${data.userId}`, { type: 'notification', data });
  }
}

/**
 * SOS Created Consumer
 */
class SOSCreatedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-sos',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.SOS_CREATED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { sosId: string; userId: string; tripId?: string; location: { lat: number; lng: number } };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.SOS_CREATED });

    // Send SOS alert to all connected admin/support users
    const sent = ConnectionStore.sendToAdmins({
      type: 'sos_alert',
      data: {
        sosId: data.sosId,
        userId: data.userId,
        tripId: data.tripId,
        location: data.location,
        status: 'ACTIVE',
      },
    });
    log('info', 'SOS alert sent to admins', { sosId: data.sosId, adminsNotified: sent });
  }
}

/**
 * SOS Resolved Consumer
 */
class SOSResolvedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-sos-resolved',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.SOS_RESOLVED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { sosId: string; resolvedBy: string; resolution: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.SOS_RESOLVED });

    // Notify admins that SOS was resolved
    ConnectionStore.sendToAdmins({
      type: 'sos_resolved',
      data: {
        sosId: data.sosId,
        resolvedBy: data.resolvedBy,
        resolution: data.resolution,
      },
    });
    log('info', 'SOS resolved notification sent', { sosId: data.sosId });
  }
}

/**
 * Trip No Match Consumer
 */
class TripNoMatchConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-trip-no-match',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.TRIP_NO_MATCH,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { tripId: string; riderId: string; reason: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_NO_MATCH });

    ConnectionStore.send(`trip:${data.tripId}:rider`, {
      type: 'trip_no_match',
      data: { tripId: data.tripId, reason: data.reason },
    });

    log('info', 'Trip no match forwarded to rider', { tripId: data.tripId, riderId: data.riderId });
  }
}

/**
 * Trip Cancelled Consumer
 */
class TripCancelledConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'websocket-server-trip-cancelled',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.TRIP_CANCELLED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { tripId: string; driverId?: string; riderId: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_CANCELLED });

    if (data.driverId) {
      await redisCluster.del(`driver:trip:target:${data.driverId}`);
      await redisCluster.del(`driver:osrm:cache:${data.driverId}`);
      await redisCluster.del(`driver:osrm:refresh:${data.driverId}`);
      await redisCluster.del(`driver:active_trip:${data.driverId}`);
    }

    // Notify rider
    ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_cancelled', data });

    // Notify driver if assigned
    if (data.driverId) {
      const sent = ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_cancelled', data });
      log('info', 'Trip cancellation forwarded to driver', { tripId: data.tripId, driverId: data.driverId, sent });
    } else {
      const fallbackSent = ConnectionStore.send(`trip:${data.tripId}:driver`, { type: 'trip_cancelled', data });
      log('info', 'Trip cancellation fallback to trip driver channel', { tripId: data.tripId, sent: fallbackSent });
    }
  }
}

/**
 * Payment Processed Consumer
 */
class PaymentProcessedConsumer extends JetStreamConsumer {
  constructor(nc: NatsConnection, idempotency: IdempotencyService) {
    super(nc, {
      streamName: 'AIN_RIDER_FINANCIAL',
      consumerName: 'websocket-server-payment',
      serviceName: 'websocket-server',
      filterSubject: NATS_SUBJECTS.PAYMENT_PROCESSED,
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    }, { idempotencyService: idempotency });
  }

  async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, _traceId: string): Promise<void> {
    const data = envelope.data as { paymentId: string; tripId: string; riderId: string; driverId: string; amount: number; status: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.PAYMENT_PROCESSED });

    // Notify rider
    ConnectionStore.send(`trip:${data.tripId}:rider`, {
      type: 'payment_processed',
      data: { paymentId: data.paymentId, amount: data.amount, status: data.status },
    });

    // Notify driver
    ConnectionStore.send(`driver:${data.driverId}`, {
      type: 'payment_processed',
      data: { paymentId: data.paymentId, amount: data.amount, status: data.status },
    });
  }
}

/**
 * Initialize NATS connection and all consumers
 */
export async function initNatsConsumers(): Promise<void> {
  // Connect to NATS
  nc = await createNatsConnection({ servers: NATS_SERVERS, name: 'websocket-server' });
  log('info', 'Connected to NATS JetStream');

  // Initialize idempotency service with the shared Redis Cluster client
  idempotency = new IdempotencyService(redisCluster);
  await idempotency.connect();

  // Create and start all consumers
  const consumerClasses = [
    LocationUpdateConsumer,
    TripAssignedConsumer,
    TripMatchedConsumer,
    TripStartedConsumer,
    TripCompletedConsumer,
    TripNoMatchConsumer,
    NotificationConsumer,
    SOSCreatedConsumer,
    SOSResolvedConsumer,
    PaymentProcessedConsumer,
    TripCancelledConsumer,
  ];

  for (const ConsumerClass of consumerClasses) {
    const consumer = new ConsumerClass(nc, idempotency);
    await consumer.start();
    consumers.push(consumer);
  }
  log('info', 'JetStream consumers initialized', { count: consumers.length });
  wsConnectionsTotal.set(ConnectionStore.size());
}

/**
 * Stop all NATS consumers gracefully
 */
export async function stopNatsConsumers(): Promise<void> {
  const promises = consumers.map(c => c.stop());
  await Promise.all(promises);
}
