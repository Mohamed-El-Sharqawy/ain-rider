import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { NatsModule } from '../shared/nats/nats.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserSuspendResponder } from '../nats/responders/user-suspend.responder';
import { UserActivateResponder } from '../nats/responders/user-activate.responder';
import { UserEventPublisher } from '../events/user-event.publisher';
import { FirebaseService } from './firebase.service';

@Module({
  imports: [
    NatsModule,
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') || 'change-me-in-production';
        return { secret };
      },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    UserSuspendResponder,
    UserActivateResponder,
    UserEventPublisher,
    FirebaseService,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
