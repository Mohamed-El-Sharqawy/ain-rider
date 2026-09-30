import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly internalSecret: string;
  private readonly jwtSecret: string;

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {
    this.internalSecret = this.config.get<string>('INTERNAL_SERVICE_SECRET')
      ?? (() => { throw new Error('[AdminGuard] FATAL: INTERNAL_SERVICE_SECRET is required.'); })();
    this.jwtSecret = this.config.get<string>('JWT_SECRET')
      ?? (() => { throw new Error('[AdminGuard] FATAL: JWT_SECRET is required.'); })();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7);

    let payload: { sub: string; email: string; role: string; type?: string; internal?: boolean; service?: string };
    try {
      try {
        payload = await this.jwtService.verifyAsync(token, { secret: this.internalSecret });
      } catch {
        payload = await this.jwtService.verifyAsync(token, { secret: this.jwtSecret });
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.role !== 'ADMIN' && payload.role !== 'SUPPORT') {
      throw new ForbiddenException('Admin or Support access required');
    }

    (request as any).user = payload;
    return true;
  }
}
