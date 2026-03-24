import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { 
  createNatsConnection, 
  createPublisher, 
  createResponder,
  JetStreamPublisher,
  IdempotencyService,
} from '@ain-rider/nats-client';
import type { NatsPublisher, NatsResponder } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import { createClient } from 'redis';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _responder: NatsResponder;
  private _jsPublisher: JetStreamPublisher;
  private _idempotency: IdempotencyService;

  async onModuleInit() {
    this.connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'trip-service',
    });
    this._publisher = createPublisher(this.connection);
    this._responder = createResponder(this.connection);
    this._jsPublisher = new JetStreamPublisher(this.connection, 'trip-service');
    
    // Initialize idempotency service with Redis
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();
    this._idempotency = new IdempotencyService(redisClient);
    
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

  get jsPublisher(): JetStreamPublisher {
    return this._jsPublisher;
  }

  get idempotency(): IdempotencyService {
    return this._idempotency;
  }

  get nc(): NatsConnection {
    return this.connection;
  }
}
