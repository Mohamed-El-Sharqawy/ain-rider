/**
 * User Event Payloads
 * 
 * Events for user lifecycle: create, update, status change, delete
 */

// ─────────────────────────────────────────────────────────────────────────────
// User Created - Published by auth-service when new user registers
// ─────────────────────────────────────────────────────────────────────────────

export interface UserCreatedPayload {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: 'RIDER' | 'DRIVER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// User Updated - Published by auth-service when profile changes
// ─────────────────────────────────────────────────────────────────────────────

export interface UserUpdatedPayload {
  id: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string | null;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// User Status Changed - Published by auth-service when status changes
// ─────────────────────────────────────────────────────────────────────────────

export interface UserStatusChangedPayload {
  id: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string; // admin user ID or 'SYSTEM'
  reason?: string | null;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// User Deleted - Published by auth-service when user is soft-deleted
// ─────────────────────────────────────────────────────────────────────────────

export interface UserDeletedPayload {
  id: string;
  deletedBy: string; // admin user ID or 'SYSTEM'
  deletionReason?: string | null;
  deletedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type UserCreatedEvent = UserCreatedPayload;
export type UserUpdatedEvent = UserUpdatedPayload;
export type UserStatusChangedEvent = UserStatusChangedPayload;
export type UserDeletedEvent = UserDeletedPayload;
