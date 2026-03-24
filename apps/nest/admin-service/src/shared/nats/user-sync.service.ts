// ─── User Sync Service ────────────────────────────────────────────────────────
// Maintains a local shadow copy of users from auth-service in ainrider_admin.
// Subscriptions are started by NatsService AFTER the NATS connection is ready,
// avoiding the race condition where OnModuleInit order is not guaranteed.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { NatsConsumer } from '@ain-rider/nats-client';
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  UserStatusChangedEvent,
  UserDeletedEvent,
} from '@ain-rider/shared-types';

@Injectable()
export class UserSyncService {
  constructor(private prisma: PrismaService) {}

  // Called by NatsService once the consumer is ready.
  async startSubscriptions(consumer: NatsConsumer): Promise<void> {
    await Promise.all([
      this.subscribeUserCreated(consumer),
      this.subscribeUserUpdated(consumer),
      this.subscribeUserStatusChanged(consumer),
      this.subscribeUserDeleted(consumer),
    ]);
    console.log('[UserSync] All user-event subscriptions active');
  }

  private subscribeUserCreated(consumer: NatsConsumer) {
    return consumer
      .subscribe<UserCreatedEvent['data']>(
        NATS_SUBJECTS.USER_CREATED,
        async (data) => {
          await this.prisma.userShadow.upsert({
            where: { id: data.id },
            create: {
              id: data.id,
              email: data.email,
              phoneNumber: data.phoneNumber,
              firstName: data.firstName,
              lastName: data.lastName,
              role: data.role,
              status: data.status,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
            },
            update: {
              email: data.email,
              phoneNumber: data.phoneNumber,
              firstName: data.firstName,
              lastName: data.lastName,
              role: data.role,
              status: data.status,
              updatedAt: new Date(data.updatedAt),
              syncedAt: new Date(),
            },
          });
          console.log(`[UserSync] USER_CREATED → synced ${data.id} (${data.email})`);
        },
        { consumer: 'admin-service-user-created' },
      )
      .catch((err) => console.error('[UserSync] USER_CREATED subscribe error:', err));
  }

  private subscribeUserUpdated(consumer: NatsConsumer) {
    return consumer
      .subscribe<UserUpdatedEvent['data']>(
        NATS_SUBJECTS.USER_UPDATED,
        async (data) => {
          await this.prisma.userShadow.updateMany({
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
          console.log(`[UserSync] USER_UPDATED → synced ${data.id}`);
        },
        { consumer: 'admin-service-user-updated' },
      )
      .catch((err) => console.error('[UserSync] USER_UPDATED subscribe error:', err));
  }

  private subscribeUserStatusChanged(consumer: NatsConsumer) {
    return consumer
      .subscribe<UserStatusChangedEvent['data']>(
        NATS_SUBJECTS.USER_STATUS_CHANGED,
        async (data) => {
          await this.prisma.userShadow.updateMany({
            where: { id: data.id },
            data: {
              status: data.status,
              updatedAt: new Date(data.updatedAt),
              syncedAt: new Date(),
            },
          });
          console.log(`[UserSync] USER_STATUS_CHANGED → ${data.id} = ${data.status}`);
        },
        { consumer: 'admin-service-user-status' },
      )
      .catch((err) => console.error('[UserSync] USER_STATUS_CHANGED subscribe error:', err));
  }

  private subscribeUserDeleted(consumer: NatsConsumer) {
    return consumer
      .subscribe<UserDeletedEvent['data']>(
        NATS_SUBJECTS.USER_DELETED,
        async (data) => {
          await this.prisma.userShadow.updateMany({
            where: { id: data.id },
            data: {
              status: 'DELETED',
              updatedAt: new Date(data.deletedAt),
              syncedAt: new Date(),
            },
          });
          console.log(`[UserSync] USER_DELETED → soft-deleted ${data.id}`);
        },
        { consumer: 'admin-service-user-deleted' },
      )
      .catch((err) => console.error('[UserSync] USER_DELETED subscribe error:', err));
  }
}
