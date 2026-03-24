import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { NatsModule } from '../shared/nats/nats.module';
import { AuthDbService } from '../prisma/auth-db.service';
import { AdminNatsClient } from '../nats/admin-nats.client';

@Module({
  imports: [AuthModule, NatsModule],
  controllers: [UsersController],
  providers: [UsersService, AuthDbService, AdminNatsClient],
  exports: [UsersService],
})
export class UsersModule {}
