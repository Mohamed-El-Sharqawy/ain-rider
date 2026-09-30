/**
 * User Event Publisher
 *
 * Publishes user lifecycle events to NATS JetStream for downstream services to sync shadow tables.
 */

import { Injectable } from "@nestjs/common";
import { JetStreamPublisher } from "@ain-rider/nats-client";
import { NATS_SUBJECTS } from "@ain-rider/shared-types";
import { NatsService } from "../shared/nats/nats.service";
import type { User } from "../generated/prisma/client";

@Injectable()
export class UserEventPublisher {
  private _publisher: JetStreamPublisher | null = null;

  constructor(private nats: NatsService) {}

  private get publisher(): JetStreamPublisher {
    if (!this._publisher) {
      this._publisher = new JetStreamPublisher(this.nats.nc, "auth-service");
    }
    return this._publisher;
  }

  /**
   * Publish user_created event when a new user registers or is created by admin
   */
  async publishUserCreated(user: User, traceId: string): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.USER_CREATED,
      "user_created",
      {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      { traceId },
    );
    console.log(
      `[UserEventPublisher] Published user_created | userId=${user.id} | traceId=${traceId}`,
    );
  }

  /**
   * Publish user_updated event when profile changes
   */
  async publishUserUpdated(
    user: User,
    changes: Partial<{
      email: string;
      phoneNumber: string;
      firstName: string;
      lastName: string;
      profileImage: string;
    }>,
    updatedBy: string | undefined,
    traceId: string,
  ): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.USER_UPDATED,
      "user_updated",
      {
        id: user.id,
        ...changes,
        updatedAt: user.updatedAt.toISOString(),
      },
      { traceId },
    );
    console.log(
      `[UserEventPublisher] Published user_updated | userId=${user.id} | updatedBy=${updatedBy || "N/A"} | traceId=${traceId}`,
    );
  }

  /**
   * Publish user_status_changed event when status changes (suspend, activate, ban)
   */
  async publishUserStatusChanged(
    user: User,
    previousStatus: string,
    changedBy: string,
    reason: string | undefined,
    traceId: string,
  ): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.USER_STATUS_CHANGED,
      "user_status_changed",
      {
        id: user.id,
        previousStatus,
        newStatus: user.status,
        changedBy,
        reason: reason || null,
        updatedAt: user.updatedAt.toISOString(),
      },
      { traceId },
    );
    console.log(
      `[UserEventPublisher] Published user_status_changed | userId=${user.id} | ${previousStatus}→${user.status} | traceId=${traceId}`,
    );
  }

  /**
   * Publish user_deleted event when user is soft-deleted
   */
  async publishUserDeleted(
    userId: string,
    deletedBy: string,
    reason: string | undefined,
    traceId: string,
  ): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.USER_DELETED,
      "user_deleted",
      {
        id: userId,
        deletedBy,
        deletionReason: reason || null,
        deletedAt: new Date().toISOString(),
      },
      { traceId },
    );
    console.log(
      `[UserEventPublisher] Published user_deleted | userId=${userId} | deletedBy=${deletedBy} | traceId=${traceId}`,
    );
  }

  /**
   * Publish otp_verified event when user verifies phone via Firebase Auth.
   *
   * Event payload structure:
   * - subject: `ain_rider.otp_verified`
   * - phoneNumber: E.164 formatted phone number (e.g., "+9647701234567")
   * - uid: Firebase Auth user ID
   * - verifiedAt: ISO 8601 timestamp of verification
   *
   * Downstream consumers can use this event to:
   * - Auto-create user accounts with verified phone
   * - Link Firebase UID to existing user records
   * - Send welcome SMS or push notifications
   *
   * @param phoneNumber - E.164 formatted phone number
   * @param uid - Firebase Auth UID
   * @param traceId - Distributed tracing correlation ID
   */
  async publishOtpVerified(
    phoneNumber: string,
    uid: string,
    traceId: string,
  ): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.OTP_VERIFIED,
      "otp_verified",
      {
        phoneNumber,
        uid,
        verifiedAt: new Date().toISOString(),
      },
      { traceId },
    );
    console.log(
      `[UserEventPublisher] Published otp_verified | phoneNumber=${phoneNumber} | uid=${uid} | traceId=${traceId}`,
    );
  }
}
