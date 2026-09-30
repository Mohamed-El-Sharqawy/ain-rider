import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard';
import { RolesGuard } from './roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') || 'change-me-in-production';
        console.log('[AdminService AuthModule] Configuring JWT with secret:', secret.substring(0, 10) + '...', 'Full length:', secret.length);
        return { secret };
      },
    }),
  ],
  providers: [AdminGuard, RolesGuard, JwtAuthGuard],
  exports: [AdminGuard, RolesGuard, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
