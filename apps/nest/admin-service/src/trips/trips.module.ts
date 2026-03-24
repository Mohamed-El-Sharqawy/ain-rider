// ─── Trips Module ────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripDbService } from '../prisma/trip-db.service';
import { NatsModule } from '../shared/nats/nats.module';

@Module({
  imports: [
    NatsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [TripsController],
  providers: [TripsService, TripDbService],
  exports: [TripsService],
})
export class TripsModule {}
