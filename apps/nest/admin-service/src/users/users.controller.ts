// ─── Users Controller ─────────────────────────────────────────────────────────
// Admin endpoints for viewing and managing users.
// Reads directly from auth-service's database, writes via NATS.

import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UserFiltersDto } from './dto/user-filters.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with filters and pagination' })
  findAll(@Query() filters: UserFiltersDto) {
    return this.usersService.findAll(filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user statistics' })
  getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user status' })
  @ApiParam({ name: 'id', type: String })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.updateStatus(id, body.status, body.reason, user.sub);
  }
}
