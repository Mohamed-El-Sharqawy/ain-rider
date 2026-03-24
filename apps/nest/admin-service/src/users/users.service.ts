// ─── Users Service ────────────────────────────────────────────────────────────
// Provides read operations directly from auth-service's database.
// Write operations (status changes) are sent via NATS to auth-service.

import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthDbService } from '../prisma/auth-db.service';
import { AdminNatsClient } from '../nats/admin-nats.client';
import { UserFiltersDto } from './dto/user-filters.dto';

@Injectable()
export class UsersService {
  constructor(
    private authDb: AuthDbService,
    private adminNats: AdminNatsClient,
  ) {}

  async findAll(filters: UserFiltersDto) {
    return this.authDb.findAllUsers(filters);
  }

  async findById(id: string) {
    const user = await this.authDb.findUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let roleData = null;
    if (user.role === 'DRIVER') {
      roleData = await this.authDb.findDriverByUserId(id);
    } else if (user.role === 'RIDER') {
      roleData = await this.authDb.findRiderByUserId(id);
    }

    return { ...user, roleData };
  }

  async getStats() {
    return this.authDb.getUserStats();
  }

  async suspendUser(userId: string, reason: string, suspendedBy: string) {
    const user = await this.authDb.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Send suspend request via NATS to auth-service
    const result = await this.adminNats.suspendUser(userId, reason, suspendedBy);

    return { success: true, message: 'User suspended', ...result };
  }

  async activateUser(userId: string, activatedBy: string) {
    const user = await this.authDb.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Send activate request via NATS to auth-service
    const result = await this.adminNats.activateUser(userId, activatedBy);

    return { success: true, message: 'User activated', ...result };
  }
}
