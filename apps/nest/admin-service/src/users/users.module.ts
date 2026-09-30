import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { NatsModule } from '../shared/nats/nats.module';
import { AdminNatsClient } from '../nats/admin-nats.client';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, NatsModule, PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, AdminNatsClient],
  exports: [UsersService],
})
export class UsersModule {}
