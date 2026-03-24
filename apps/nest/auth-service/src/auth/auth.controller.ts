import { Controller, Post, Get, Body, UseGuards, Request, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { UserRole } from '@ain-rider/shared-types';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (RIDER or DRIVER only)' })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('admin/create-user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin only: Create users with any role' })
  async adminCreateUser(@Body() body: AdminCreateUserDto, @Request() req: any) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can create users');
    }
    return this.authService.adminCreateUser(body, req.user.sub);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  me(@Request() req: any) {
    const { passwordHash, ...user } = req.user;
    return user;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  async refresh(@Request() req: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const token = authHeader.substring(7);
    
    try {
      const payload = this.authService.verifyToken(token);
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return this.authService.refresh(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
