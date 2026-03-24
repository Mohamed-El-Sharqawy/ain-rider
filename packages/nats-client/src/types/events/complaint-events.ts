/**
 * Complaint Event Payloads
 * 
 * Events for complaint handling
 */

// ─────────────────────────────────────────────────────────────────────────────
// Complaint Created - Published when user submits complaint
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplaintCreatedPayload {
  complaintId: string;
  tripId?: string | null;
  complainantId: string;
  complainantType: 'RIDER' | 'DRIVER';
  reportedUserId?: string | null;
  category: 'SAFETY' | 'SERVICE' | 'PAYMENT' | 'BEHAVIOR' | 'OTHER';
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Complaint Updated - Published when complaint status changes
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplaintUpdatedPayload {
  complaintId: string;
  previousStatus: string;
  newStatus: string;
  resolution?: string | null;
  resolvedBy?: string | null;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type ComplaintCreatedEvent = ComplaintCreatedPayload;
export type ComplaintUpdatedEvent = ComplaintUpdatedPayload;
