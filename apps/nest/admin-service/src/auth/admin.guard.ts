import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const authHeader = request.headers['authorization'];

    console.log('[AdminGuard] canActivate called');
    console.log('[AdminGuard] Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING');
    console.log('[AdminGuard] All headers:', Object.keys(request.headers));

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AdminGuard] Missing or invalid authorization header');
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice(7);
    console.log('[AdminGuard] Token extracted, length:', token.length);

    let payload: { sub: string; email: string; role: string; type?: string };
    try {
      const secret = this.config.get<string>('JWT_SECRET') || 'change-me-in-production';
      console.log('[AdminGuard] Verifying with secret:', secret.substring(0, 10) + '...', 'Full length:', secret.length);
      
      payload = await this.jwtService.verifyAsync(token, { secret });
      
      console.log('[AdminGuard] Token verified successfully:', {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        type: payload.type,
      });
    } catch (error) {
      console.log('[AdminGuard] Token verification failed:', error instanceof Error ? error.message : String(error));
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.role !== 'ADMIN' && payload.role !== 'SUPPORT') {
      console.log('[AdminGuard] Insufficient role:', payload.role);
      throw new ForbiddenException('Admin or Support access required');
    }

    console.log('[AdminGuard] Authorization successful for:', payload.email);
    (request as any).user = payload;
    return true;
  }
}
