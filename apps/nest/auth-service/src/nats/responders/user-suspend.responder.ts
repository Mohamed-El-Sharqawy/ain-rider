/**
 * User Suspend Responder
 * 
 * Handles user.suspend.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { AuthService } from '../../auth/auth.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface SuspendUserRequest {
  userId: string;
  reason: string;
  suspendedBy: string;
}

export interface SuspendUserResponse {
  userId: string;
  newStatus: string;
}

@Injectable()
export class UserSuspendResponder implements OnModuleInit, OnModuleDestroy {
  private responder: NatsResponder;

  constructor(
    private authService: AuthService,
    private natsService: NatsService,
  ) {}

  async onModuleInit() {
    // Wait for NatsService to be ready
    let retries = 0;
    while (!this.natsService.nc && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!this.natsService.nc) {
      console.error('[UserSuspendResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<SuspendUserRequest, SuspendUserResponse>(
      'user.suspend.request',
      async (request) => {
        const { userId, suspendedBy } = request;

        console.log(
          `[UserSuspendResponder] Processing suspend request | userId=${userId}`
        );

        // Update user status to SUSPENDED
        const user = await this.authService.updateUserStatus(userId, 'SUSPENDED');

        console.log(
          `[UserSuspendResponder] User suspended | userId=${userId} | suspendedBy=${suspendedBy}`
        );

        return {
          userId: user.id,
          newStatus: user.status,
        };
      }
    );

    console.log('[UserSuspendResponder] Started listening on user.suspend.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[UserSuspendResponder] Stopped');
  }
}
