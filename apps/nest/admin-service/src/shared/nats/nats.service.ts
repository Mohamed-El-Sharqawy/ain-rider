import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  createNatsConnection,
  createPublisher,
  createConsumer,
  createRequester,
  JetStreamPublisher,
} from '@ain-rider/nats-client';
import type { NatsPublisher, NatsConsumer, NatsRequester } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import { UserSyncService } from './user-sync.service';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private _connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _consumer: NatsConsumer;
  private _requester: NatsRequester;
  private _jsPublisher: JetStreamPublisher;
  private isShuttingDown = false;

  constructor(private userSync: UserSyncService) {}

  async onModuleInit() {
    this._connection = await createNatsConnection({
      servers: process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'],
      name: 'admin-service',
    });
    this._publisher = createPublisher(this._connection);
    this._consumer = createConsumer(this._connection);
    this._requester = createRequester(this._connection);
    this._jsPublisher = new JetStreamPublisher(this._connection, 'admin-service');
    console.log('[NATS] admin-service connected');

    this.userSync.startSubscriptions(this._connection).catch((err) =>
      console.error('[NATS] Failed to start user sync subscriptions:', err),
    );
  }

  async onModuleDestroy() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    await this.userSync.onModuleDestroy();

    console.log('[NATS] Graceful shutdown initiated...');

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (this._connection) {
      try {
        await this._connection.drain();
        console.log('[NATS] Connection drained');
      } catch (err) {
        console.error('[NATS] Error draining connection:', err);
      }
    }

    console.log('[NATS] Graceful shutdown complete');
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

  get jsPublisher(): JetStreamPublisher {
    return this._jsPublisher;
  }

  get nc(): NatsConnection {
    return this._connection;
  }
}
