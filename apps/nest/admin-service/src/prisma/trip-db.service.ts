// ─── Trip DB Read-Only Service ───────────────────────────────────────────────
// Read-only Prisma client for trip-service's database.
// Admin-service READS directly but NEVER writes — writes go via NATS to trip-service.
// Trip-service owns the schema and all migrations.

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, type Trip } from '../generated/trip-prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export type { Trip };

export interface TripFilters {
  status?: string;
  paymentStatus?: string;
  riderId?: string;
  driverId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TripDbService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.TRIP_DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 5,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('[TripDB] Read-only Prisma connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async findAll(filters: TripFilters): Promise<{ data: Trip[]; meta: any }> {
    const { status, paymentStatus, riderId, driverId, search, page = 1, limit = 20 } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (riderId) {
      where.riderId = riderId;
    }
    if (driverId) {
      where.driverId = driverId;
    }
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { riderId: { contains: search, mode: 'insensitive' } },
        { driverId: { contains: search, mode: 'insensitive' } },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { dropoffAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.trip.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.trip.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<Trip | null> {
    return this.trip.findUnique({ where: { id } });
  }

  async getStats(): Promise<{
    total: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    revenue: number;
    pendingPayments: number;
    collectedPayments: number;
  }> {
    const [total, completed, cancelled, inProgress, revenueResult, pendingPayments, collectedPayments] =
      await Promise.all([
        this.trip.count(),
        this.trip.count({ where: { status: 'COMPLETED' } }),
        this.trip.count({ where: { status: 'CANCELLED' } }),
        this.trip.count({ where: { status: 'IN_PROGRESS' } }),
        this.trip.aggregate({
          where: { status: 'COMPLETED', paymentStatus: 'COLLECTED' },
          _sum: { actualFare: true },
        }),
        this.trip.count({ where: { status: 'COMPLETED', paymentStatus: 'PENDING' } }),
        this.trip.count({ where: { paymentStatus: 'COLLECTED' } }),
      ]);

    return {
      total,
      completed,
      cancelled,
      inProgress,
      revenue: revenueResult._sum.actualFare ?? 0,
      pendingPayments,
      collectedPayments,
    };
  }
}
