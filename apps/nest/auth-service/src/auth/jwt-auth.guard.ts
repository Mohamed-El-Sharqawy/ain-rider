import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    console.log('[JwtAuthGuard] canActivate called');
    console.log('[JwtAuthGuard] Authorization header:', authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING');
    console.log('[JwtAuthGuard] All headers:', Object.keys(request.headers));
    
    if (!authHeader) {
      console.log('[JwtAuthGuard] No authorization header found');
      throw new UnauthorizedException('No authorization header');
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    console.log('[JwtAuthGuard] handleRequest called');
    console.log('[JwtAuthGuard] Error:', err);
    console.log('[JwtAuthGuard] User:', user ? user.id : 'null');
    console.log('[JwtAuthGuard] Info:', info);
    
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }
}
