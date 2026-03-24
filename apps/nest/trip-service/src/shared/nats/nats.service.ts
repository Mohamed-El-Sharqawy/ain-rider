import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createNatsConnection, createPublisher, createResponder } from '@ain-rider/nats-client';
import type { NatsPublisher, NatsResponder } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _responder: NatsResponder;

  async onModuleInit() {
    this.connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'trip-service',
    });
    this._publisher = createPublisher(this.connection);
    this._responder = createResponder(this.connection);
    console.log('[NATS] trip-service connected');
  }

  async onModuleDestroy() {
    await this._responder?.close();
    await this.connection?.close();
  }

  get publisher(): NatsPublisher {
    return this._publisher;
  }

  get responder(): NatsResponder {
    return this._responder;
  }
}
