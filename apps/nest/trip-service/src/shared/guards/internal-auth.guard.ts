import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Internal service auth header missing');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid internal service auth format');
    }

    try {
      const secret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      if (!payload.internal) {
        throw new UnauthorizedException('Not an internal service token');
      }

      request['service'] = payload.service;
      return true;
    } catch (e) {
      console.error('[InternalAuthGuard] Error:', e instanceof Error ? e.message : String(e));
      throw new UnauthorizedException('Invalid internal service token');
    }
  }
}
