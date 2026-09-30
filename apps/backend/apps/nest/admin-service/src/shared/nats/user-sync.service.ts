import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import {
  JetStreamConsumer,
  StreamManager,
  EventEnvelope,
  IdempotencyService,
  createIdempotencyService,
  type ConsumerConfig,
} from '@ain-rider/nats-client';
import { NATS_SUBJECTS, EventValidators } from '@ain-rider/shared-types';
import type { NatsConnection, JsMsg } from 'nats';
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  UserStatusChangedEvent,
  UserDeletedEvent,
} from '@ain-rider/shared-types';
import type { ShadowUserRole, ShadowUserStatus } from '../../generated/prisma';

const STREAM_NAME = 'AIN_RIDER_AUTH';
const USER_SUBJECTS = [
  NATS_SUBJECTS.USER_CREATED,
  NATS_SUBJECTS.USER_UPDATED,
  NATS_SUBJECTS.USER_STATUS_CHANGED,
  NATS_SUBJECTS.USER_DELETED,
];

@Injectable()
export class UserSyncService implements OnModuleDestroy {
  private consumers: JetStreamConsumer[] = [];
  private idempotency: IdempotencyService | null = null;

  constructor(
    private prisma: PrismaService,
    private cache: RedisCacheService,
  ) {}

  async startSubscriptions(nc: NatsConnection): Promise<void> {
    const redisClient = this.cache.getCluster();
    this.idempotency = createIdempotencyService(redisClient);

    const streamManager = new StreamManager(nc);
    await streamManager.ensureStream(STREAM_NAME, {
      subjects: USER_SUBJECTS,
      storage: 'file',
      retention: 'limits',
    });

    await Promise.all([
      this.consumeUserCreated(nc),
      this.consumeUserUpdated(nc),
      this.consumeUserStatusChanged(nc),
      this.consumeUserDeleted(nc),
    ]);
    console.log('[UserSync] All JetStream consumers active');
  }

  private async consumeUserCreated(nc: NatsConnection) {
    const consumer = new (class extends JetStreamConsumer {
      private sync: UserSyncService;

      constructor(nc2: NatsConnection, config: ConsumerConfig, sync: UserSyncService, idempotency: IdempotencyService) {
        super(nc2, config, { idempotencyService: idempotency });
        this.sync = sync;
      }

      async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, traceId: string): Promise<void> {
        const data = envelope.data as UserCreatedEvent['data'];
        const validation = EventValidators.USER_CREATED(data);
        if (!validation.valid) {
          console.error(`[UserSync] Invalid USER_CREATED payload: missing ${validation.missing.join(', ')} | traceId=${traceId}`);
          return;
        }

        await this.sync.prisma.userShadow.upsert({
          where: { id: data.id },
          create: {
            id: data.id,
            email: data.email,
            phoneNumber: data.phoneNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role as ShadowUserRole,
            status: data.status as ShadowUserStatus,
            profileImage: (data as Record<string, unknown>).profileImage as string | null ?? null,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          },
          update: {
            email: data.email,
            phoneNumber: data.phoneNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role as ShadowUserRole,
            status: data.status as ShadowUserStatus,
            updatedAt: new Date(data.updatedAt),
            syncedAt: new Date(),
          },
        });

        await this.sync.cache.invalidateAll(data.id);
        console.log(`[UserSync] USER_CREATED → upserted ${data.id} (${data.email}) | traceId=${traceId}`);
      }
    })(nc, {
      streamName: STREAM_NAME,
      consumerName: 'admin-user-created-js',
      serviceName: 'admin-service',
      filterSubject: NATS_SUBJECTS.USER_CREATED,
      maxDeliver: 5,
      enableIdempotency: true,
      enableDLQ: true,
    }, this, this.idempotency!);

    await consumer.start();
    this.consumers.push(consumer);
  }

  private async consumeUserUpdated(nc: NatsConnection) {
    const consumer = new (class extends JetStreamConsumer {
      private sync: UserSyncService;

      constructor(nc2: NatsConnection, config: ConsumerConfig, sync: UserSyncService, idempotency: IdempotencyService) {
        super(nc2, config, { idempotencyService: idempotency });
        this.sync = sync;
      }

      async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, traceId: string): Promise<void> {
        const data = envelope.data as UserUpdatedEvent['data'];
        const validation = EventValidators.USER_UPDATED(data);
        if (!validation.valid) {
          console.error(`[UserSync] Invalid USER_UPDATED payload: missing ${validation.missing.join(', ')} | traceId=${traceId}`);
          return;
        }

        await this.sync.prisma.userShadow.updateMany({
          where: { id: data.id },
          data: {
            ...(data.email && { email: data.email }),
            ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
            ...(data.profileImage !== undefined && { profileImage: data.profileImage }),
            updatedAt: new Date(data.updatedAt),
            syncedAt: new Date(),
          },
        });

        await this.sync.cache.invalidateAll(data.id);
        console.log(`[UserSync] USER_UPDATED → synced ${data.id} | traceId=${traceId}`);
      }
    })(nc, {
      streamName: STREAM_NAME,
      consumerName: 'admin-user-updated-js',
      serviceName: 'admin-service',
      filterSubject: NATS_SUBJECTS.USER_UPDATED,
      maxDeliver: 5,
      enableIdempotency: true,
      enableDLQ: true,
    }, this, this.idempotency!);

    await consumer.start();
    this.consumers.push(consumer);
  }

  private async consumeUserStatusChanged(nc: NatsConnection) {
    const consumer = new (class extends JetStreamConsumer {
      private sync: UserSyncService;

      constructor(nc2: NatsConnection, config: ConsumerConfig, sync: UserSyncService, idempotency: IdempotencyService) {
        super(nc2, config, { idempotencyService: idempotency });
        this.sync = sync;
      }

      async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, traceId: string): Promise<void> {
        const data = envelope.data as UserStatusChangedEvent['data'];
        const validation = EventValidators.USER_STATUS_CHANGED(data);
        if (!validation.valid) {
          console.error(`[UserSync] Invalid USER_STATUS_CHANGED payload: missing ${validation.missing.join(', ')} | traceId=${traceId}`);
          return;
        }

        await this.sync.prisma.userShadow.updateMany({
          where: { id: data.id },
          data: {
            status: data.status as ShadowUserStatus,
            updatedAt: new Date(data.updatedAt),
            syncedAt: new Date(),
          },
        });

        await this.sync.cache.invalidateAll(data.id);
        console.log(`[UserSync] USER_STATUS_CHANGED → ${data.id} = ${data.status} | traceId=${traceId}`);
      }
    })(nc, {
      streamName: STREAM_NAME,
      consumerName: 'admin-user-status-js',
      serviceName: 'admin-service',
      filterSubject: NATS_SUBJECTS.USER_STATUS_CHANGED,
      maxDeliver: 5,
      enableIdempotency: true,
      enableDLQ: true,
    }, this, this.idempotency!);

    await consumer.start();
    this.consumers.push(consumer);
  }

  private async consumeUserDeleted(nc: NatsConnection) {
    const consumer = new (class extends JetStreamConsumer {
      private sync: UserSyncService;

      constructor(nc2: NatsConnection, config: ConsumerConfig, sync: UserSyncService, idempotency: IdempotencyService) {
        super(nc2, config, { idempotencyService: idempotency });
        this.sync = sync;
      }

      async handleMessage(envelope: EventEnvelope<unknown>, _msg: JsMsg, traceId: string): Promise<void> {
        const data = envelope.data as UserDeletedEvent['data'];
        const validation = EventValidators.USER_DELETED(data);
        if (!validation.valid) {
          console.error(`[UserSync] Invalid USER_DELETED payload: missing ${validation.missing.join(', ')} | traceId=${traceId}`);
          return;
        }

        await this.sync.prisma.userShadow.updateMany({
          where: { id: data.id },
          data: {
            status: 'DELETED' as ShadowUserStatus,
            updatedAt: new Date(data.deletedAt),
            syncedAt: new Date(),
          },
        });

        await this.sync.cache.invalidateAll(data.id);
        console.log(`[UserSync] USER_DELETED → soft-deleted ${data.id} | traceId=${traceId}`);
      }
    })(nc, {
      streamName: STREAM_NAME,
      consumerName: 'admin-user-deleted-js',
      serviceName: 'admin-service',
      filterSubject: NATS_SUBJECTS.USER_DELETED,
      maxDeliver: 5,
      enableIdempotency: true,
      enableDLQ: true,
    }, this, this.idempotency!);

    await consumer.start();
    this.consumers.push(consumer);
  }

  async onModuleDestroy() {
    for (const consumer of this.consumers) {
      try {
        await consumer.stop();
      } catch {}
    }
    this.consumers = [];
    console.log('[UserSync] All consumers stopped');
  }
}
