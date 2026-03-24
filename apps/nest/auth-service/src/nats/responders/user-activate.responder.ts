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
