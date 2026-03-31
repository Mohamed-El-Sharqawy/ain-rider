import { Controller, Get, Query, Param, UseGuards, NotFoundException, Patch, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('admin')
@Controller('auth/admin')
@UseGuards(InternalAuthGuard)
@ApiBearerAuth('internal-secret')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users (Admin only)' })
  async listUsers(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('role') role?: string,
  ) {
    return this.authService.findAllUsers({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      role,
    });
  }

  @Get('users/stats')
  @ApiOperation({ summary: 'Get user stats (Admin only)' })
  async getStats() {
    return this.authService.getUserStats();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details by ID (Admin only)' })
  async getUser(@Param('id') id: string) {
    const user = await this.authService.findUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user profile (Admin only)' })
  async updateUser(@Param('id') id: string, @Body() data: any) {
    return this.authService.updateUser(id, data);
  }
}
