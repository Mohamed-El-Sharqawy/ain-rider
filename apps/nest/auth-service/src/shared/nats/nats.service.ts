import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import type { NatsPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private _connection: NatsConnection;
  private _publisher: NatsPublisher;

  async onModuleInit() {
    this._connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'auth-service',
    });
    this._publisher = createPublisher(this._connection);
    console.log('[NATS] auth-service connected');
  }

  async onModuleDestroy() {
    await this._connection?.close();
  }

  get publisher(): NatsPublisher {
    return this._publisher;
  }

  get nc(): NatsConnection {
    return this._connection;
  }
}
