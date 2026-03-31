import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interface representing the structure of an audit log entry.
 */
export interface AuditLogData {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

@Injectable()
export class AdminAuditLogger {
  constructor(private prisma: PrismaService) {}

  /**
   * Persists an audit log entry to the database.
   * 
   * @param data - The audit log data to be recorded
   * @returns A promise that resolves to the created audit log entry
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      console.log(`[AdminAuditLogger] Action=${data.action} | Target=${data.targetType}:${data.targetId} | Admin=${data.adminId}`);
      
      await this.prisma.adminAuditLog.create({
        data: {
          adminId: data.adminId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          previousState: data.previousState ?? undefined,
          newState: data.newState ?? undefined,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          reason: data.reason,
        },
      });
    } catch (e) {
      console.error('[AdminAuditLogger] Failed to create audit log:', e instanceof Error ? e.message : String(e));
      // Swallow error to prevent disrupting the main business logic flow
    }
  }
}
