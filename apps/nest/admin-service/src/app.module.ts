import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from './prisma/prisma.module';
import { NatsModule } from './shared/nats/nats.module';
import { StorageModule } from './shared/storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TripsModule } from './trips/trips.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WalletsModule } from './wallets/wallets.module';
import { PromosModule } from './promos/promos.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { SettingsModule } from './settings/settings.module';
import { ProfileModule } from './profile/profile.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    PrismaModule,
    NatsModule,
    StorageModule,
    AuthModule,
    UsersModule,
    TripsModule,
    VehiclesModule,
    WalletsModule,
    PromosModule,
    NotificationsModule,
    ComplaintsModule,
    SettingsModule,
    ProfileModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
