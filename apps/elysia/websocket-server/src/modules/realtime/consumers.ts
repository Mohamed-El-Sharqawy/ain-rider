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
  createClient,
} from '@ain-rider/nats-client';
import type { NatsConnection, JsMsg } from '@ain-rider/nats-client';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { LocationUpdate } from '@ain-rider/shared-types';
import { ConnectionStore } from '../../shared/connections';
import { natsEventsTotal, wsConnectionsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NATS_SERVERS = process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'];

// Driver watchers: driverId -> Set of WebSocket keys watching this driver
const driverWatchers = new Map<string, Set<string>>();

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

    // Send to driver's own connection
    const sent = ConnectionStore.send(`driver:${data.driverId}`, {
      type: 'location_update',
      data,
    });

    // If driver not connected, send to riders watching this driver
    if (!sent) {
      ConnectionStore.send(`trip:${data.driverId}:rider`, {
        type: 'driver_location_update',
        data,
      });
    }

    // Send to all watchers of this driver
    const watchers = driverWatchers.get(data.driverId);
    if (watchers) {
      for (const watcherKey of watchers) {
        ConnectionStore.send(watcherKey, {
          type: 'driver_location_update',
          data,
        });
      }
    }
  }
}

/**
 * Trip Matched Consumer
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
    const data = envelope.data as { tripId: string; driverId: string; estimatedArrival: number };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_MATCHED });

    ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_matched', data });
    ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_assigned', data });

    // Add rider as watcher of this driver
    const watchers = driverWatchers.get(data.driverId) ?? new Set();
    watchers.add(`trip:${data.tripId}:rider`);
    driverWatchers.set(data.driverId, watchers);
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
    const data = envelope.data as { tripId: string; driverId: string };
    natsEventsTotal.inc({ subject: NATS_SUBJECTS.TRIP_STARTED });

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

    ConnectionStore.send(`trip:${data.tripId}:rider`, { type: 'trip_completed', data });
    ConnectionStore.send(`driver:${data.driverId}`, { type: 'trip_completed', data });

    // Remove rider from driver watchers
    const watchers = driverWatchers.get(data.driverId);
    if (watchers) {
      watchers.delete(`trip:${data.tripId}:rider`);
      if (watchers.size === 0) {
        driverWatchers.delete(data.driverId);
      }
    }
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

  // Initialize idempotency service with Redis
  const redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();
  idempotency = new IdempotencyService(redisClient);

  // Create and start all consumers
  const consumerClasses = [
    LocationUpdateConsumer,
    TripMatchedConsumer,
    TripStartedConsumer,
    TripCompletedConsumer,
    NotificationConsumer,
    SOSCreatedConsumer,
    SOSResolvedConsumer,
    PaymentProcessedConsumer,
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
 * Stop all consumers gracefully
 */
export async function stopNatsConsumers(): Promise<void> {
  for (const consumer of consumers) {
    await consumer.stop();
  }
  log('info', 'JetStream consumers stopped');
}

/**
 * Add a watcher for a driver's location updates
 */
export function addDriverWatcher(driverId: string, watcherKey: string): void {
  const watchers = driverWatchers.get(driverId) ?? new Set();
  watchers.add(watcherKey);
  driverWatchers.set(driverId, watchers);
  log('info', 'Driver watcher added', { driverId, watcherKey, totalWatchers: watchers.size });
}

/**
 * Remove a watcher for a driver's location updates
 */
export function removeDriverWatcher(driverId: string, watcherKey: string): void {
  const watchers = driverWatchers.get(driverId);
  if (watchers) {
    watchers.delete(watcherKey);
    if (watchers.size === 0) {
      driverWatchers.delete(driverId);
    }
    log('info', 'Driver watcher removed', { driverId, watcherKey });
  }
}
