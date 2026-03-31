import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { NatsModule } from './shared/nats/nats.module';
import { TripsModule } from './trips/trips.module';
import { HealthController } from './health/health.controller';
import { InternalAuthGuard } from './shared/guards/internal-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('INTERNAL_SERVICE_SECRET');
        return { secret };
      },
    }),
    TerminusModule,
    PrismaModule,
    NatsModule,
    TripsModule,
  ],
  providers: [InternalAuthGuard],
  controllers: [HealthController],
  exports: [JwtModule, InternalAuthGuard],
})
export class AppModule {}
