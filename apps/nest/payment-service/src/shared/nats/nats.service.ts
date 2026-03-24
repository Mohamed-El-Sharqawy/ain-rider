import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { 
  createNatsConnection, 
  createPublisher,
  JetStreamPublisher,
  IdempotencyService,
} from '@ain-rider/nats-client';
import type { NatsPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import { createClient } from 'redis';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _jsPublisher: JetStreamPublisher;
  private _idempotency: IdempotencyService;

  async onModuleInit() {
    this.connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'payment-service',
    });
    this._publisher = createPublisher(this.connection);
    this._jsPublisher = new JetStreamPublisher(this.connection, 'payment-service');
    
    // Initialize idempotency service with Redis
    const redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();
    this._idempotency = new IdempotencyService(redisClient);
    
    console.log('[NATS] payment-service connected');
  }

  async onModuleDestroy() {
    await this.connection?.close();
  }

  get publisher(): NatsPublisher {
    return this._publisher;
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
