import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { AuthService } from '../../auth/auth.service';
import { DriverOnboardingService } from '../../driver-onboarding/driver-onboarding.service';
import { NatsService } from '../../shared/nats/nats.service';

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
      console.log(`[AdminCommandHandler] Suspending user: ${data.userId}`);
      await this.authService.updateUserStatus(data.userId, 'SUSPENDED', data.adminId, data.reason);
      return { success: true };
    });

    // Activate user
    await this.responder.respond('admin.command.activate_user', async (data: { userId: string, adminId: string }) => {
      console.log(`[AdminCommandHandler] Activating user: ${data.userId}`);
      await this.authService.updateUserStatus(data.userId, 'ACTIVE', data.adminId);
      return { success: true };
    });

    // Approve driver
    await this.responder.respond('admin.command.approve_driver', async (data: { userId: string, adminId: string }) => {
      console.log(`[AdminCommandHandler] Approving driver: ${data.userId}`);
      await this.driverOnboardingService.approveDriver(data.userId);
      return { success: true };
    });

    // Reject driver document
    await this.responder.respond("admin.command.reject_driver_document", async (data: { userId: string, stage: "identity" | "license" | "vehicle", reason: string, adminId: string }) => {
      console.log(`[AdminCommandHandler] Rejecting driver ${data.stage} for user: ${data.userId}`);
      await this.driverOnboardingService.rejectDocument(data.userId, data.stage, data.reason);
      return { success: true };
    });

    // Update user status (generic)
    await this.responder.respond('admin.command.update_user_status', async (data: { userId: string, status: string, adminId: string, reason?: string }) => {
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
