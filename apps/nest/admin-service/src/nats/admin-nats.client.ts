/**
 * Admin NATS Client
 * 
 * Client for making NATS request/reply calls to other services.
 * Used by admin-service to trigger operations in auth, trip, and payment services.
 */

import { Injectable } from '@nestjs/common';
import { NatsRequestClient } from '@ain-rider/nats-client';
import { NatsService } from '../shared/nats/nats.service';

// Request/Response types
export interface SuspendUserRequest {
  userId: string;
  reason: string;
  suspendedBy: string;
}

export interface SuspendUserResponse {
  userId: string;
  newStatus: string;
}

export interface ActivateUserRequest {
  userId: string;
  activatedBy: string;
}

export interface ActivateUserResponse {
  userId: string;
  newStatus: string;
}

export interface CancelTripRequest {
  tripId: string;
  reason: string;
  cancelledBy: string;
}

export interface CancelTripResponse {
  tripId: string;
  newStatus: string;
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason: string;
  requestedBy: string;
}

export interface RefundResponse {
  refundId: string;
  amount: number;
}

@Injectable()
export class AdminNatsClient {
  private _requestClient: NatsRequestClient | null = null;

  constructor(private natsService: NatsService) {}

  private get requestClient(): NatsRequestClient {
    if (!this._requestClient) {
      if (!this.natsService.nc) {
        throw new Error('NATS connection not ready');
      }
      this._requestClient = new NatsRequestClient(this.natsService.nc);
    }
    return this._requestClient;
  }

  /**
   * Suspend a user via auth-service
   */
  async suspendUser(
    userId: string,
    reason: string,
    adminId: string,
    traceId?: string
  ): Promise<SuspendUserResponse> {
    return this.requestClient.request<SuspendUserRequest, SuspendUserResponse>(
      'user.suspend.request',
      { userId, reason, suspendedBy: adminId },
      { traceId, requestedBy: adminId }
    );
  }

  /**
   * Activate a user via auth-service
   */
  async activateUser(
    userId: string,
    adminId: string,
    traceId?: string
  ): Promise<ActivateUserResponse> {
    return this.requestClient.request<ActivateUserRequest, ActivateUserResponse>(
      'user.activate.request',
      { userId, activatedBy: adminId },
      { traceId, requestedBy: adminId }
    );
  }

  /**
   * Cancel a trip via trip-service
   */
  async cancelTrip(
    tripId: string,
    reason: string,
    adminId: string,
    traceId?: string
  ): Promise<CancelTripResponse> {
    return this.requestClient.request<CancelTripRequest, CancelTripResponse>(
      'trip.cancel.request',
      { tripId, reason, cancelledBy: adminId },
      { traceId, requestedBy: adminId }
    );
  }

  /**
   * Assign a driver to a trip via trip-service
   */
  async assignDriver(
    tripId: string,
    driverId: string,
    adminId: string,
    traceId?: string
  ): Promise<{ tripId: string; driverId: string }> {
    return this.requestClient.request<
      { tripId: string; driverId: string; assignedBy: string },
      { tripId: string; driverId: string }
    >(
      'trip.assign_driver.request',
      { tripId, driverId, assignedBy: adminId },
      { traceId, requestedBy: adminId }
    );
  }

  /**
   * Process a refund via payment-service
   */
  async refundPayment(
    paymentId: string,
    amount: number,
    reason: string,
    adminId: string,
    traceId?: string
  ): Promise<RefundResponse> {
    return this.requestClient.request<RefundRequest, RefundResponse>(
      'payment.refund.request',
      { paymentId, amount, reason, requestedBy: adminId },
      { traceId, requestedBy: adminId }
    );
  }
}
