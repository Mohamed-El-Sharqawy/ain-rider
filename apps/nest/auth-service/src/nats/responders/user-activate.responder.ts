/**
 * User Activate Responder
 * 
 * Handles user.activate.request via NATS request/reply
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NatsResponder } from '@ain-rider/nats-client';
import { AuthService } from '../../auth/auth.service';
import { NatsService } from '../../shared/nats/nats.service';

export interface ActivateUserRequest {
  userId: string;
  activatedBy: string;
}

export interface ActivateUserResponse {
  userId: string;
  newStatus: string;
}

@Injectable()
export class UserActivateResponder implements OnModuleInit, OnModuleDestroy {
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
      console.error('[UserActivateResponder] NATS connection not available after 5s');
      return;
    }

    this.responder = new NatsResponder(this.natsService.nc);

    await this.responder.respond<ActivateUserRequest, ActivateUserResponse>(
      'user.activate.request',
      async (request) => {
        const { userId } = request;

        console.log(
          `[UserActivateResponder] Processing activate request | userId=${userId}`
        );

        // Update user status to ACTIVE
        const user = await this.authService.updateUserStatus(userId, 'ACTIVE');

        console.log(
          `[UserActivateResponder] User activated | userId=${userId}`
        );

        return {
          userId: user.id,
          newStatus: user.status,
        };
      }
    );

    console.log('[UserActivateResponder] Started listening on user.activate.request');
  }

  async onModuleDestroy() {
    if (this.responder) {
      await this.responder.close();
    }
    console.log('[UserActivateResponder] Stopped');
  }
}
