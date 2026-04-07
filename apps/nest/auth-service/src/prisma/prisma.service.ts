import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { prismaMetricsExtension } from '@ain-rider/metrics';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: any;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 10,
    });

    const client = new PrismaClient({ adapter });
    this.prisma = client.$extends(prismaMetricsExtension('auth-service'));

    // Proxy everything to the extended prisma client
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return (target as any)[prop];
        return (target.prisma as any)[prop];
      },
    });
  }

  async onModuleInit() {
    await this.prisma.$connect();
    console.log('[Prisma] Connected to database with metrics extension');
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    console.log('[Prisma] Disconnected from database');
  }
}
export interface PrismaService extends PrismaClient { }
