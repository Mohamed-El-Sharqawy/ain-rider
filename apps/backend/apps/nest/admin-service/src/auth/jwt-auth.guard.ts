import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly internalSecret: string;
  private readonly jwtSecret: string;

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {
    this.internalSecret = this.config.get<string>('INTERNAL_SERVICE_SECRET')
      ?? (() => { throw new Error('[JwtAuthGuard] FATAL: INTERNAL_SERVICE_SECRET is required.'); })();
    this.jwtSecret = this.config.get<string>('JWT_SECRET')
      ?? (() => { throw new Error('[JwtAuthGuard] FATAL: JWT_SECRET is required.'); })();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7);

    try {
      let payload;
      try {
        payload = await this.jwtService.verifyAsync(token, { secret: this.internalSecret });
      } catch {
        payload = await this.jwtService.verifyAsync(token, { secret: this.jwtSecret });
      }

      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
