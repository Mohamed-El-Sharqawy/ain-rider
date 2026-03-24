// ─── Users Service ────────────────────────────────────────────────────────────
// Provides read operations directly from auth-service's database.
// Write operations (status changes) are sent via NATS to auth-service.

import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthDbService } from '../prisma/auth-db.service';
import { NatsService } from '../shared/nats/nats.service';
import { UserFiltersDto } from './dto/user-filters.dto';

@Injectable()
export class UsersService {
  constructor(
    private authDb: AuthDbService,
    private nats: NatsService,
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

  async updateStatus(userId: string, status: string, reason?: string, updatedBy?: string) {
    const user = await this.authDb.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Send status update via NATS to auth-service
    await this.nats.requester.request('ain_rider.user.update_status', {
      userId,
      status,
      reason,
      updatedBy,
      previousStatus: user.status,
    });

    return { success: true, message: 'Status update request sent' };
  }
}
