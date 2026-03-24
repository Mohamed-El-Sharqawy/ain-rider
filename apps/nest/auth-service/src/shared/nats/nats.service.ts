import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import type { NatsPublisher } from '@ain-rider/nats-client';
import type { NatsConnection } from 'nats';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private _connection: NatsConnection;
  private _publisher: NatsPublisher;
  private isShuttingDown = false;

  async onModuleInit() {
    this._connection = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'auth-service',
    });
    this._publisher = createPublisher(this._connection);
    console.log('[NATS] auth-service connected');
  }

  async onModuleDestroy() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    console.log('[NATS] Graceful shutdown initiated...');
    
    // Wait briefly for in-flight messages
    await new Promise(resolve => setTimeout(resolve, 500));
    
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

  get nc(): NatsConnection {
    return this._connection;
  }
}
