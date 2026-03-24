// ─── Auth DB Read-Only Service ───────────────────────────────────────────────
// Read-only Prisma client for auth-service's database.
// Admin-service READS directly but NEVER writes — writes go via NATS to auth-service.
// Auth-service owns the schema and all migrations.

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, type User, type Driver, type Rider } from '../generated/auth-prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export type { User, Driver, Rider };

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuthDbService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.AUTH_DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 5,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('[AuthDB] Read-only Prisma connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async findAllUsers(filters: UserFilters): Promise<{ data: Omit<User, 'passwordHash'>[]; meta: any }> {
    const { role, status, search, page = 1, limit = 20 } = filters;

    const where: any = {};

    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          profileImage: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.user.count({ where }),
    ]);

    return {
      data: data as Omit<User, 'passwordHash'>[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    return this.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as Promise<Omit<User, 'passwordHash'> | null>;
  }

  async findDriverByUserId(userId: string): Promise<Driver | null> {
    return this.driver.findUnique({ where: { userId } });
  }

  async findRiderByUserId(userId: string): Promise<Rider | null> {
    return this.rider.findUnique({ where: { userId } });
  }

  async getUserStats(): Promise<{
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    onlineDrivers: number;
  }> {
    const [total, byRole, byStatus, onlineDrivers] = await Promise.all([
      this.user.count(),
      this.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      this.user.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.driver.count({ where: { isOnline: true } }),
    ]);

    return {
      total,
      byRole: byRole.reduce((acc, r) => ({ ...acc, [r.role]: r._count }), {}),
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      onlineDrivers,
    };
  }
}
