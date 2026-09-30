import { Injectable, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { AuthService } from '../../auth/auth.service';
import { DriverOnboardingService } from '../../driver-onboarding/driver-onboarding.service';
import { NatsService } from '../../shared/nats/nats.service';

function validateRequired(data: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new BadRequestException(`Missing required field: ${field}`);
    }
  }
}

function validateStringField(data: Record<string, unknown>, field: string, allowed: string[]): void {
  if (data[field] !== undefined && !allowed.includes(data[field] as string)) {
    throw new BadRequestException(`Invalid value for ${field}: ${data[field]}. Allowed: ${allowed.join(', ')}`);
  }
}

@Injectable()
export class AdminCommandHandler implements OnModuleInit, OnModuleDestroy {
  private responder: NatsResponder | null = null;

  constructor(
    private authService: AuthService,
    private driverOnboardingService: DriverOnboardingService,
    private natsService: NatsService,
  ) { }

  async onModuleInit() {
    // Wait for NatsService to be ready
    let retries = 0;
    while (!this.natsService.nc && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!this.natsService.nc) {
      console.error('[AdminCommandHandler] NATS connection not available');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    // Suspend user
    await this.responder.respond('admin.command.suspend_user', async (data: { userId: string, reason: string, adminId: string }) => {
      validateRequired(data, ['userId', 'reason', 'adminId']);
      console.log(`[AdminCommandHandler] Suspending user: ${data.userId}`);
      await this.authService.updateUserStatus(data.userId, 'SUSPENDED', data.adminId, data.reason);
      return { success: true };
    });

    await this.responder.respond('admin.command.activate_user', async (data: { userId: string, adminId: string }) => {
      validateRequired(data, ['userId', 'adminId']);
      console.log(`[AdminCommandHandler] Activating user: ${data.userId}`);
      await this.authService.updateUserStatus(data.userId, 'ACTIVE', data.adminId);
      return { success: true };
    });

    await this.responder.respond('admin.command.approve_driver', async (data: { userId: string, adminId: string }) => {
      validateRequired(data, ['userId', 'adminId']);
      console.log(`[AdminCommandHandler] Approving driver: ${data.userId}`);
      await this.driverOnboardingService.approveDriver(data.userId);
      return { success: true };
    });

    await this.responder.respond("admin.command.reject_driver_document", async (data: { userId: string, stage: "identity" | "license" | "vehicle", reason: string, adminId: string }) => {
      validateRequired(data, ['userId', 'stage', 'reason', 'adminId']);
      validateStringField(data, 'stage', ['identity', 'license', 'vehicle']);
      console.log(`[AdminCommandHandler] Rejecting driver ${data.stage} for user: ${data.userId}`);
      await this.driverOnboardingService.rejectDocument(data.userId, data.stage, data.reason);
      return { success: true };
    });

    await this.responder.respond("admin.command.approve_driver_document", async (data: { userId: string, stage: "identity" | "license" | "vehicle", adminId: string }) => {
      validateRequired(data, ['userId', 'stage', 'adminId']);
      validateStringField(data, 'stage', ['identity', 'license', 'vehicle']);
      console.log(`[AdminCommandHandler] Approving driver ${data.stage} for user: ${data.userId}`);
      await this.driverOnboardingService.approveDocument(data.userId, data.stage);
      return { success: true };
    });

    await this.responder.respond('admin.command.update_user_status', async (data: { userId: string, status: string, adminId: string, reason?: string }) => {
      validateRequired(data, ['userId', 'status', 'adminId']);
      console.log(`[AdminCommandHandler] Updating user status: ${data.userId} to ${data.status}`);
      await this.authService.updateUserStatus(data.userId, data.status, data.adminId, data.reason);
      return { success: true, newStatus: data.status };
    });

    console.log('[AdminCommandHandler] Listening on admin.command subjects');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[AdminCommandHandler] Stopped');
  }
}
