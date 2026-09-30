import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminNatsClient } from '../nats/admin-nats.client';
import { UserFiltersDto } from './dto/user-filters.dto';
import { InternalApiClient } from '../shared/internal-api/internal-api.client';
import { AdminAuditLogger } from '../shared/audit/admin-audit-logger.service';
import { RedisCacheService } from '../shared/redis-cache/redis-cache.service';
import { ConfigService } from '@nestjs/config';
import type { UserShadow, ShadowUserRole, ShadowUserStatus } from '../generated/prisma';

type UserShadowWithExtras = UserShadow & Record<string, unknown>;

@Injectable()
export class UsersService {
  private readonly authUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private internalApi: InternalApiClient,
    private adminNats: AdminNatsClient,
    private auditLogger: AdminAuditLogger,
    private cache: RedisCacheService,
  ) {
    this.authUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:4000';
  }

  async findAll(filters: UserFiltersDto) {
    const skip = filters.page && filters.limit ? (filters.page - 1) * filters.limit : 0;
    const take = filters.limit || 20;

    const cacheKey = `list:${filters.role || 'all'}:${filters.status || 'all'}:${filters.search || 'all'}:${skip}:${take}`;
    const cached = await this.cache.getUserList<{ users: UserShadow[]; total: number }>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = {};
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phoneNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.userShadow.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userShadow.count({ where }),
    ]);

    const result = { users, total };
    await this.cache.setUserList(cacheKey, result);
    return result;
  }

  async findById(id: string) {
    const cached = await this.cache.getUser<UserShadow>(id);
    if (cached) return cached;

    const user = await this.prisma.userShadow.findUnique({ where: { id } });
    if (!user) {
      try {
        const fallback = await this.internalApi.fetchInternal(`${this.authUrl}/auth/admin/users/${id}`);
        if (fallback) return fallback as UserShadow;
      } catch {}
      throw new NotFoundException('User not found');
    }

    await this.cache.setUser(id, user);
    return user;
  }

  async getStats() {
    const cached = await this.cache.getUserStats<{ total: number; active: number; drivers: number; riders: number; suspended: number }>('global');
    if (cached) return cached;

    const [total, active, drivers, riders, suspended] = await Promise.all([
      this.prisma.userShadow.count(),
      this.prisma.userShadow.count({ where: { status: 'ACTIVE' as ShadowUserStatus } }),
      this.prisma.userShadow.count({ where: { role: 'DRIVER' as ShadowUserRole } }),
      this.prisma.userShadow.count({ where: { role: 'RIDER' as ShadowUserRole } }),
      this.prisma.userShadow.count({ where: { status: 'SUSPENDED' as ShadowUserStatus } }),
    ]);

    const result = { total, active, drivers, riders, suspended };
    await this.cache.setUserStats('global', result);
    return result;
  }

  async suspendUser(userId: string, reason: string, adminId: string) {
    const previousUser = await this.findById(userId);

    const result = await this.adminNats.suspendUser(userId, reason, adminId);

    await this.auditLogger.log({
      adminId,
      action: 'USER_SUSPEND',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: { ...(previousUser as UserShadowWithExtras), status: 'SUSPENDED' },
      reason,
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: 'User suspended', ...result };
  }

  async activateUser(userId: string, adminId: string) {
    const previousUser = await this.findById(userId);

    const result = await this.adminNats.activateUser(userId, adminId);

    await this.auditLogger.log({
      adminId,
      action: 'USER_ACTIVATE',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: { ...(previousUser as UserShadowWithExtras), status: 'ACTIVE' },
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: 'User activated', ...result };
  }

  async updateStatus(userId: string, status: string, adminId: string, reason?: string) {
    const previousUser = await this.findById(userId);

    const result = await this.adminNats.updateUserStatus(userId, status, adminId, reason);

    await this.auditLogger.log({
      adminId,
      action: 'USER_STATUS_UPDATE',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: { ...(previousUser as UserShadowWithExtras), status },
      reason,
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: `User status updated to ${status}`, ...result };
  }

  async approveDriver(userId: string, adminId: string) {
    const previousUser = await this.findById(userId);

    const result = await this.adminNats.approveDriver(userId, adminId);

    await this.auditLogger.log({
      adminId,
      action: 'DRIVER_APPROVE',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: { ...(previousUser as UserShadowWithExtras), onboardingStatus: 'APPROVED' },
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: 'Driver approved', ...result };
  }

  async rejectDriverDocument(userId: string, stage: 'identity' | 'license' | 'vehicle', reason: string, adminId: string) {
    const previousUser = await this.findById(userId);

    const result = await this.adminNats.rejectDriverDocument(userId, stage, reason, adminId);

    await this.auditLogger.log({
      adminId,
      action: 'DRIVER_REJECT_DOCUMENT',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: { ...(previousUser as UserShadowWithExtras), onboardingStatus: 'PENDING_DOCUMENTS', rejectionStage: stage, reason },
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: `Driver ${stage} rejected`, ...result };
  }

  async approveDriverDocument(userId: string, stage: 'identity' | 'license' | 'vehicle', adminId: string) {
    const previousUser = await this.findById(userId);

    const result = await this.adminNats.approveDriverDocument(userId, stage, adminId);

    await this.auditLogger.log({
      adminId,
      action: 'DRIVER_APPROVE_DOCUMENT',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: { ...(previousUser as UserShadowWithExtras), lastApprovedStage: stage },
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: `Driver ${stage} approved`, ...result };
  }

  async resetUploadAttempts(userId: string, adminId: string) {
    const previousUser = await this.findById(userId);

    const result = await this.internalApi.fetchInternal(`${this.authUrl}/auth/driver/${userId}/reset-attempts`, 'PATCH');

    await this.auditLogger.log({
      adminId,
      action: 'RESET_UPLOAD_ATTEMPTS',
      targetType: 'USER',
      targetId: userId,
      previousState: previousUser as UserShadowWithExtras,
      newState: previousUser as UserShadowWithExtras,
    });

    await this.cache.invalidateAll(userId);
    return { success: true, message: 'Upload attempts reset', ...(result as Record<string, unknown>) };
  }

  async getOnboardingStatus(userId: string) {
    try {
      const result = await this.internalApi.fetchInternal(`${this.authUrl}/auth/driver/${userId}/onboarding-status`);
      return result;
    } catch (error) {
      console.error(`[UsersService] Failed to fetch onboarding status for ${userId}:`, error);
      throw error;
    }
  }
}
