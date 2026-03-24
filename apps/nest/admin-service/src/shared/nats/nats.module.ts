import { Module, Global } from '@nestjs/common';
import { NatsService } from './nats.service';
import { UserSyncService } from './user-sync.service';

@Global()
@Module({
  // UserSyncService is listed first so NestJS instantiates it before NatsService.
  // NatsService injects UserSyncService and calls startSubscriptions() only after
  // the NATS connection is established — no race condition.
  providers: [UserSyncService, NatsService],
  exports: [NatsService],
})
export class NatsModule {}
