// ─── Users Service ────────────────────────────────────────────────────────────
// Provides read operations directly from auth-service's database.
// Write operations (status changes) are sent via NATS to auth-service.

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminNatsClient } from '../nats/admin-nats.client';
import { UserFiltersDto } from './dto/user-filters.dto';
import { InternalApiClient } from '../shared/internal-api/internal-api.client';
import { AdminAuditLogger } from '../shared/audit/admin-audit-logger.service';

@Injectable()
export class UsersService {
  private readonly authUrl: string;

  constructor(
    private configService: ConfigService,
    private internalApi: InternalApiClient,
    private adminNats: AdminNatsClient,
    private auditLogger: AdminAuditLogger,
  ) {
    this.authUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:4000';
  }

  async findAll(filters: UserFiltersDto) {
    const skip = filters.page && filters.limit ? (filters.page - 1) * filters.limit : 0;
    const take = filters.limit || 20;

    const queryParams = new URLSearchParams();
    queryParams.append('skip', skip.toString());
    queryParams.append('take', take.toString());
    if (filters.role) queryParams.append('role', filters.role);

    return this.internalApi.fetchInternal(`${this.authUrl}/auth/admin/users?${queryParams.toString()}`);
  }

  async findById(id: string) {
    return this.internalApi.fetchInternal(`${this.authUrl}/auth/admin/users/${id}`);
  }

  async getStats() {
    return this.internalApi.fetchInternal(`${this.authUrl}/auth/admin/users/stats`);
  }

  async suspendUser(userId: string, reason: string, adminId: string) {
    // 1. Get previous state for audit log
    const previousUser = await this.findById(userId);

    // 2. Publish NATS command
    const result = await this.adminNats.suspendUser(userId, reason, adminId);

    // 3. Log to local audit
    await this.auditLogger.log({
      adminId,
      action: 'USER_SUSPEND',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser,
      newState: { ...(previousUser as any), status: 'SUSPENDED' },
      reason,
    });

    return { success: true, message: 'User suspended', ...result };
  }

  async activateUser(userId: string, adminId: string) {
    // 1. Get previous state
    const previousUser = await this.findById(userId);

    // 2. Publish NATS command
    const result = await this.adminNats.activateUser(userId, adminId);

    // 3. Log to local audit
    await this.auditLogger.log({
      adminId,
      action: 'USER_ACTIVATE',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser,
      newState: { ...(previousUser as any), status: 'ACTIVE' },
    });

    return { success: true, message: 'User activated', ...result };
  }

  async updateStatus(userId: string, status: string, adminId: string, reason?: string) {
    // 1. Get previous state for audit log
    const previousUser = await this.findById(userId);

    // 2. Publish NATS command
    const result = await this.adminNats.updateUserStatus(userId, status, adminId, reason);

    // 3. Log to local audit
    await this.auditLogger.log({
      adminId,
      action: 'USER_STATUS_UPDATE',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser,
      newState: { ...(previousUser as any), status },
      reason,
    });

    return { success: true, message: `User status updated to ${status}`, ...result };
  }

  async approveDriver(userId: string, adminId: string) {
    // 1. Get previous state
    const previousUser = await this.findById(userId);

    // 2. Publish NATS command
    const result = await this.adminNats.approveDriver(userId, adminId);

    // 3. Log to local audit
    await this.auditLogger.log({
      adminId,
      action: 'DRIVER_APPROVE',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser,
      newState: { ...(previousUser as any), onboardingStatus: 'APPROVED' },
    });

    return { success: true, message: 'Driver approved', ...result };
  }
}
