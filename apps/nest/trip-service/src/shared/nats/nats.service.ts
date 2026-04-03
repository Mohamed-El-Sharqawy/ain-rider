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
import { createRedisCluster } from '@ain-rider/redis-client';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private connection: NatsConnection;
  private _publisher: NatsPublisher;
  private _responder: NatsResponder;
  private _jsPublisher: JetStreamPublisher;
  private _idempotency: IdempotencyService;
  private isShuttingDown = false;

  async onModuleInit() {
    this.connection = await createNatsConnection({
      // url: process.env.NATS_URL || 'nats://localhost:4222',
      servers: process.env.NATS_SERVERS?.split(',') || ['nats://localhost:4222'],
      name: 'trip-service',
    });
    this._publisher = createPublisher(this.connection);
    this._responder = createResponder(this.connection);
    this._jsPublisher = new JetStreamPublisher(this.connection, 'trip-service');
    
    // Initialize idempotency service with Redis Cluster
    const redisCluster = createRedisCluster({
      nodes: process.env.REDIS_NODES?.split(',') || ['localhost:6379'],
    });
    this._idempotency = new IdempotencyService(redisCluster);
    
    console.log('[NATS] trip-service connected');
  }

  async onModuleDestroy() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('[NATS] Graceful shutdown initiated...');
    
    // Close responder first (stops accepting new requests)
    if (this._responder) {
      try {
        await this._responder.close();
        console.log('[NATS] Responder closed');
      } catch (err) {
        console.error('[NATS] Error closing responder:', err);
      }
    }
    
    // Wait briefly for in-flight messages (max 5s)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close NATS connection
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
