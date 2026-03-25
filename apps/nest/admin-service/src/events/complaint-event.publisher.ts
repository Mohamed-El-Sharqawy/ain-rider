/**
 * Complaint Event Publisher
 * 
 * Publishes complaint events to NATS JetStream for real-time notifications and audit.
 */

import { Injectable } from '@nestjs/common';
import { JetStreamPublisher } from '@ain-rider/nats-client';
import { NATS_SUBJECTS } from '@ain-rider/shared-types';
import { NatsService } from '../shared/nats/nats.service';
import type { Complaint } from '../generated/prisma/client';

@Injectable()
export class ComplaintEventPublisher {
  private _publisher: JetStreamPublisher | null = null;

  constructor(private nats: NatsService) {}

  private get publisher(): JetStreamPublisher {
    if (!this._publisher) {
      this._publisher = new JetStreamPublisher(this.nats.nc, 'admin-service');
    }
    return this._publisher;
  }

  /**
   * Publish complaint_created event when a new complaint is submitted
   */
  async publishComplaintCreated(complaint: Complaint, traceId: string): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.COMPLAINT_CREATED,
      'complaint_created',
      {
        complaintId: complaint.id,
        complainantId: complaint.complainantId,
        complainantRole: complaint.complainantRole,
        againstUserId: complaint.againstUserId,
        type: complaint.type,
        status: complaint.status,
        description: complaint.description,
        createdAt: complaint.createdAt.toISOString(),
      },
      { traceId },
    );
    console.log(`[ComplaintEventPublisher] Published complaint_created | complaintId=${complaint.id} | traceId=${traceId}`);
  }

  /**
   * Publish complaint_updated event when complaint status changes
   */
  async publishComplaintUpdated(
    complaint: Complaint,
    previousStatus: string,
    traceId: string
  ): Promise<void> {
    await this.publisher.publish(
      NATS_SUBJECTS.COMPLAINT_UPDATED,
      'complaint_updated',
      {
        complaintId: complaint.id,
        complainantId: complaint.complainantId,
        previousStatus,
        newStatus: complaint.status,
        assignedTo: complaint.assignedTo,
        resolution: complaint.resolution,
        resolvedAt: complaint.resolvedAt?.toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { traceId },
    );
    console.log(`[ComplaintEventPublisher] Published complaint_updated | complaintId=${complaint.id} | status=${complaint.status} | traceId=${traceId}`);
  }
}
