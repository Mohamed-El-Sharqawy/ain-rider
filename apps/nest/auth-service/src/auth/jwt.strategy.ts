import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET') || 'change-me-in-production';
    console.log('[JwtStrategy] Initializing with secret:', secret.substring(0, 10) + '...', 'Full length:', secret.length);
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('[JwtStrategy] ========== VALIDATE CALLED ==========');
    console.log('[JwtStrategy] Validating payload:', {
      sub: payload.sub,
      type: payload.type,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
      iat: payload.iat,
    });

    if (payload.type !== 'access') {
      console.log('[JwtStrategy] Invalid token type:', payload.type);
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      console.log('[JwtStrategy] User not found:', payload.sub);
      throw new UnauthorizedException('User not found');
    }

    console.log('[JwtStrategy] Validation successful for user:', user.id);
    return user;
  }
}
