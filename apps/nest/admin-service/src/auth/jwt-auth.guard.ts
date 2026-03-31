import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7);

    try {
      const internalSecret = this.config.get<string>('INTERNAL_SERVICE_SECRET') || 'dev-internal-secret-987654321';
      const jwtSecret = this.config.get<string>('JWT_SECRET') || 'change-me-in-production';
      
      let payload;
      try {
        payload = await this.jwtService.verifyAsync(token, { secret: internalSecret });
      } catch (err) {
        payload = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
      }
      
      (request as any).user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
