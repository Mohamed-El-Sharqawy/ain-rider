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

    let payload: { sub: string; email: string; role: string; type?: string; internal?: boolean; service?: string };
    try {
      // 1. Try INTERNAL_SERVICE_SECRET first (standard Gateway-to-Service auth)
      const internalSecret = this.config.get<string>('INTERNAL_SERVICE_SECRET') || 'dev-internal-secret-987654321';
      console.log('[AdminGuard] Attempting verification with INTERNAL_SERVICE_SECRET');
      
      try {
        payload = await this.jwtService.verifyAsync(token, { secret: internalSecret });
        console.log('[AdminGuard] Verified as Internal Service Token from:', payload.service);
        
        // If it's an internal token, we might need to get real user role from X-Admin-Token or trust the claim in internal token
        // The api-gateway puts sub in the internal token
      } catch (err) {
        // 2. Fallback to JWT_SECRET (Original User Token)
        console.log('[AdminGuard] Internal verification failed, falling back to JWT_SECRET');
        const jwtSecret = this.config.get<string>('JWT_SECRET') || 'change-me-in-production';
        payload = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
        console.log('[AdminGuard] Verified as Original User Token');
      }
      
      console.log('[AdminGuard] Final payload:', {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      });
    } catch (error) {
      console.log('[AdminGuard] All token verification methods failed:', error instanceof Error ? error.message : String(error));
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
