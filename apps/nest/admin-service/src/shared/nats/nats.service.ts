import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  createNatsConnection,
  createPublisher,
  createConsumer,
  createRequester,
} from '@ain-rider/nats-client';
import type { NatsPublisher, NatsConsumer, NatsRequester } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import { UserSyncService } from './user-sync.service';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _consumer: NatsConsumer;
  private _requester: NatsRequester;

  constructor(private userSync: UserSyncService) {}

  async onModuleInit() {
    this.connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'admin-service',
    });
    this._publisher = createPublisher(this.connection);
    this._consumer = createConsumer(this.connection);
    this._requester = createRequester(this.connection);
    console.log('[NATS] admin-service connected');

    // Start user-event subscriptions now that consumer is ready.
    this.userSync.startSubscriptions(this._consumer).catch((err) =>
      console.error('[NATS] Failed to start user sync subscriptions:', err),
    );
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  get publisher(): NatsPublisher {
    return this._publisher;
  }

  get consumer(): NatsConsumer {
    return this._consumer;
  }

  get requester(): NatsRequester {
    return this._requester;
  }
}
