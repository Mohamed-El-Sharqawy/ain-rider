# Quickstart: NATS Inter-Service Communication

**Feature**: 002-nats-interservice-refactor  
**Date**: 2026-03-24

## Overview

This guide provides quick integration patterns for implementing NATS-based inter-service communication in the ain-rider backend.

---

## 1. Publishing JetStream Events

### Basic Publisher Setup (NestJS)

```typescript
// src/events/event-publisher.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { JetStreamClient } from 'nats';
import { randomUUID } from 'crypto';

@Injectable()
export class EventPublisherService implements OnModuleInit {
  private js: JetStreamClient;

  constructor(private nats: NatsService) {}

  async onModuleInit() {
    this.js = this.nats.jetstream();
  }

  async publish<T>(subject: string, data: T, traceId?: string): Promise<void> {
    const envelope = {
      version: 1,
      eventType: subject.split('.').pop(),
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      traceId: traceId || randomUUID(),
      source: process.env.SERVICE_NAME,
      data,
    };

    const headers = this.nats.headers();
    headers.set('traceparent', `00-${envelope.traceId}-${randomUUID().slice(0, 16)}-01`);
    headers.set('Nats-Msg-Id', envelope.eventId);

    await this.js.publish(subject, JSON.stringify(envelope), { headers });
  }
}
```

### Usage Example

```typescript
// In your service
await this.eventPublisher.publish('ain_rider.trip_requested', {
  tripId: trip.id,
  riderId: trip.riderId,
  pickupLocation: trip.pickup,
  dropoffLocation: trip.dropoff,
  vehicleType: trip.vehicleType,
  estimatedFare: trip.fare,
  requestedAt: new Date().toISOString(),
}, request.traceId);
```

---

## 2. Consuming JetStream Events

### Basic Consumer Setup (NestJS)

```typescript
// src/consumers/trip-matched.consumer.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { JetStreamClient, ConsumerMessages } from 'nats';

@Injectable()
export class TripMatchedConsumer implements OnModuleInit, OnModuleDestroy {
  private js: JetStreamClient;
  private subscription: ConsumerMessages;

  constructor(
    private nats: NatsService,
    private tripService: TripService,
    private idempotency: IdempotencyService,
  ) {}

  async onModuleInit() {
    this.js = this.nats.jetstream();
    
    const consumer = await this.js.consumers.get('AIN_RIDER_OPS', 'trip-matched-consumer');
    this.subscription = await consumer.consume();

    this.startConsuming();
  }

  private async startConsuming() {
    for await (const msg of this.subscription) {
      try {
        const envelope = JSON.parse(msg.data.toString());
        const eventId = envelope.eventId;

        // Idempotency check
        const processed = await this.idempotency.isProcessed('trip-matched', eventId);
        if (processed) {
          msg.ack();
          continue;
        }

        // Process the event
        await this.tripService.handleTripMatched(envelope.data);

        // Mark as processed and ack
        await this.idempotency.markProcessed('trip-matched', eventId);
        msg.ack();
      } catch (error) {
        console.error('Failed to process trip_matched:', error);
        msg.nak();  // Will retry up to max_deliver times
      }
    }
  }

  async onModuleDestroy() {
    await this.subscription?.close();
  }
}
```

---

## 3. Request/Reply Pattern

### Requester (Admin Service)

```typescript
// src/nats/nats-request.service.ts
import { Injectable } from '@nestjs/common';
import { NatsService } from './nats.service';
import { ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class NatsRequestService {
  private readonly TIMEOUT = 5000;  // 5 seconds

  constructor(private nats: NatsService) {}

  async request<TReq, TRes>(subject: string, data: TReq, traceId: string): Promise<TRes> {
    const request = {
      traceId,
      requestedBy: 'admin-service',
      timestamp: new Date().toISOString(),
      data,
    };

    try {
      const response = await this.nats.nc.request(
        subject,
        JSON.stringify(request),
        { timeout: this.TIMEOUT }
      );

      const result = JSON.parse(response.data.toString());
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Request failed');
      }

      return result.data;
    } catch (error) {
      if (error.code === 'TIMEOUT' || error.code === 'NO_RESPONDERS') {
        throw new ServiceUnavailableException('Service temporarily unavailable');
      }
      throw error;
    }
  }
}
```

### Responder (Auth Service)

```typescript
// src/nats/user-responder.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from './nats.service';
import { UserService } from '../user/user.service';

@Injectable()
export class UserResponderService implements OnModuleInit {
  constructor(
    private nats: NatsService,
    private userService: UserService,
  ) {}

  async onModuleInit() {
    // Register responders
    await this.registerSuspendHandler();
    await this.registerActivateHandler();
  }

  private async registerSuspendHandler() {
    const sub = this.nats.nc.subscribe('user.suspend.request');
    
    for await (const msg of sub) {
      try {
        const request = JSON.parse(msg.data.toString());
        const { userId, reason, suspendedBy } = request.data;

        const user = await this.userService.suspend(userId, reason, suspendedBy);

        msg.respond(JSON.stringify({
          success: true,
          traceId: request.traceId,
          data: { userId: user.id, newStatus: user.status },
        }));
      } catch (error) {
        msg.respond(JSON.stringify({
          success: false,
          traceId: request?.traceId,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        }));
      }
    }
  }

  private async registerActivateHandler() {
    const sub = this.nats.nc.subscribe('user.activate.request');
    
    for await (const msg of sub) {
      try {
        const request = JSON.parse(msg.data.toString());
        const { userId, activatedBy } = request.data;

        const user = await this.userService.activate(userId, activatedBy);

        msg.respond(JSON.stringify({
          success: true,
          traceId: request.traceId,
          data: { userId: user.id, newStatus: user.status },
        }));
      } catch (error) {
        msg.respond(JSON.stringify({
          success: false,
          traceId: request?.traceId,
          error: { code: 'INTERNAL_ERROR', message: error.message },
        }));
      }
    }
  }
}
```

---

## 4. Dead Letter Queue Handling

### DLQ Publisher

```typescript
// src/dlq/dlq.service.ts
import { Injectable } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';

@Injectable()
export class DLQService {
  constructor(private nats: NatsService) {}

  async sendToDLQ(
    originalSubject: string,
    originalPayload: unknown,
    errorReason: string,
    retryCount: number,
    consumerName: string,
    traceId: string,
  ): Promise<void> {
    const dlqMessage = {
      originalSubject,
      originalPayload,
      originalHeaders: {},
      errorReason,
      errorStack: new Error().stack,
      retryCount,
      consumerName,
      failedAt: new Date().toISOString(),
      traceId,
    };

    const js = this.nats.jetstream();
    await js.publish(
      `ain_rider.dlq.${originalSubject.replace('ain_rider.', '')}`,
      JSON.stringify(dlqMessage)
    );

    // Alert ops team
    console.error('[DLQ] Message sent to dead letter queue', {
      subject: originalSubject,
      consumerName,
      traceId,
    });
  }
}
```

---

## 5. Idempotency Service

```typescript
// src/shared/idempotency.service.ts
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class IdempotencyService {
  private readonly TTL = 7 * 24 * 60 * 60;  // 7 days

  constructor(private redis: Redis) {}

  async isProcessed(consumerName: string, eventId: string): Promise<boolean> {
    const key = `idempotency:${consumerName}:${eventId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async markProcessed(consumerName: string, eventId: string): Promise<void> {
    const key = `idempotency:${consumerName}:${eventId}`;
    await this.redis.setex(key, this.TTL, Date.now().toString());
  }
}
```

---

## 6. WebSocket Event Fan-out

```typescript
// websocket-server/src/consumers/event-fanout.ts
import { JetStreamClient, ConsumerMessages } from 'nats';
import { ConnectionStore } from '../connection-store';

export class EventFanout {
  private subscriptions: ConsumerMessages[] = [];

  constructor(
    private js: JetStreamClient,
    private connections: ConnectionStore,
  ) {}

  async start() {
    // Subscribe to relevant events
    const subjects = [
      'ain_rider.location_update',
      'ain_rider.trip_matched',
      'ain_rider.trip_started',
      'ain_rider.trip_completed',
      'ain_rider.trip_cancelled',
      'ain_rider.payment_processed',
      'ain_rider.sos_created',
      'ain_rider.notification_sent',
    ];

    for (const subject of subjects) {
      const consumerName = `ws-${subject.split('.').pop()}-consumer`;
      const consumer = await this.js.consumers.get('AIN_RIDER_OPS', consumerName);
      const sub = await consumer.consume();
      this.subscriptions.push(sub);
      this.consumeSubject(sub, subject);
    }
  }

  private async consumeSubject(sub: ConsumerMessages, subject: string) {
    for await (const msg of sub) {
      try {
        const envelope = JSON.parse(msg.data.toString());
        await this.fanout(subject, envelope);
        msg.ack();
      } catch (error) {
        console.error(`Failed to fanout ${subject}:`, error);
        msg.ack();  // Don't retry WebSocket fanout failures
      }
    }
  }

  private async fanout(subject: string, envelope: any) {
    const { data } = envelope;

    // Determine target users based on event type
    let targetUserIds: string[] = [];

    switch (subject) {
      case 'ain_rider.trip_matched':
      case 'ain_rider.trip_started':
      case 'ain_rider.trip_completed':
      case 'ain_rider.trip_cancelled':
        targetUserIds = [data.riderId, data.driverId].filter(Boolean);
        break;
      case 'ain_rider.location_update':
        // Fan out to riders watching this driver
        targetUserIds = await this.connections.getWatchers(data.driverId);
        break;
      case 'ain_rider.payment_processed':
        targetUserIds = [data.riderId, data.driverId];
        break;
      case 'ain_rider.sos_created':
        // Fan out to admins and support
        targetUserIds = await this.connections.getAdminUsers();
        break;
      case 'ain_rider.notification_sent':
        targetUserIds = [data.userId];
        break;
    }

    // Send to connected clients
    for (const userId of targetUserIds) {
      const socket = this.connections.get(userId);
      if (socket) {
        socket.send(JSON.stringify({
          type: subject.replace('ain_rider.', ''),
          data: envelope.data,
          timestamp: envelope.timestamp,
        }));
      }
    }
  }

  async stop() {
    for (const sub of this.subscriptions) {
      await sub.close();
    }
  }
}
```

---

## 7. Stream Setup Script

```typescript
// scripts/setup-streams.ts
import { connect, JetStreamManager } from 'nats';

async function setupStreams() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const jsm = await nc.jetstreamManager();

  // Operational events stream
  await jsm.streams.add({
    name: 'AIN_RIDER_OPS',
    subjects: [
      'ain_rider.trip_*',
      'ain_rider.user_*',
      'ain_rider.location_*',
      'ain_rider.sos_*',
      'ain_rider.notification_*',
      'ain_rider.complaint_*',
    ],
    retention: 'limits',
    max_age: 7 * 24 * 60 * 60 * 1e9,  // 7 days in nanoseconds
    storage: 'file',
    num_replicas: 3,
    discard: 'old',
  });

  // Financial events stream
  await jsm.streams.add({
    name: 'AIN_RIDER_FINANCIAL',
    subjects: [
      'ain_rider.payment_*',
      'ain_rider.wallet_*',
      'ain_rider.withdrawal_*',
    ],
    retention: 'limits',
    max_age: 30 * 24 * 60 * 60 * 1e9,  // 30 days
    storage: 'file',
    num_replicas: 3,
    discard: 'old',
  });

  // Dead letter queue stream
  await jsm.streams.add({
    name: 'AIN_RIDER_DLQ',
    subjects: ['ain_rider.dlq.*'],
    retention: 'limits',
    max_age: 30 * 24 * 60 * 60 * 1e9,
    storage: 'file',
    num_replicas: 3,
    discard: 'old',
  });

  console.log('Streams created successfully');
  await nc.close();
}

setupStreams().catch(console.error);
```

---

## Quick Reference

| Pattern | Use Case | Timeout |
|---------|----------|---------|
| JetStream Publish | Async events (trip, user, payment) | N/A |
| JetStream Consume | Event processing with retry | 30s ack wait |
| NATS Request/Reply | Admin operations | 5s |

| Stream | Retention | Events |
|--------|-----------|--------|
| AIN_RIDER_OPS | 7 days | trip, user, location, sos, notification |
| AIN_RIDER_FINANCIAL | 30 days | payment, wallet, withdrawal |
| AIN_RIDER_DLQ | 30 days | Failed messages |
