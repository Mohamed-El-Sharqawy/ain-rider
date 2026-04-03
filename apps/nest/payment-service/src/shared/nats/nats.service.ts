import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { 
  createNatsConnection, 
  createPublisher,
  JetStreamPublisher,
  IdempotencyService,
} from '@ain-rider/nats-client';
import type { NatsPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';
import { createRedisCluster } from '@ain-rider/redis-client';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _jsPublisher: JetStreamPublisher;
  private _idempotency: IdempotencyService;
  private isShuttingDown = false;

  async onModuleInit() {
    this.connection = await createNatsConnection({
      // url: process.env.NATS_URL || 'nats://localhost:4222',
      servers: process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'],
      name: 'payment-service',
    });
    this._publisher = createPublisher(this.connection);
    this._jsPublisher = new JetStreamPublisher(this.connection, 'payment-service');
    
    // Initialize idempotency service with Redis Cluster
    const redisCluster = createRedisCluster({
      nodes: process.env.REDIS_NODES?.split(',') || ['localhost:6379'],
    });
    this._idempotency = new IdempotencyService(redisCluster);
    
    console.log('[NATS] payment-service connected');
  }

  async onModuleDestroy() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('[NATS] Graceful shutdown initiated...');
    
    // Wait briefly for in-flight messages
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (this.connection) {
      try {
        await this.connection.drain();
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
