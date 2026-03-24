import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import type { NatsPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;

  async onModuleInit() {
    this.connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'payment-service',
    });
    this._publisher = createPublisher(this.connection);
    console.log('[NATS] payment-service connected');
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  get publisher(): NatsPublisher {
    return this._publisher;
  }
}
