/**
 * NATS Request/Reply Types
 * 
 * Types for synchronous request-reply pattern over NATS Core.
 * Used by admin-service to trigger operations in other services.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Request Wrapper
// ─────────────────────────────────────────────────────────────────────────────

export interface NatsRequest<T = unknown> {
  /** W3C trace-context trace ID */
  traceId: string;
  
  /** Service or user that initiated the request */
  requestedBy: string;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Request payload */
  data: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Wrapper
// ─────────────────────────────────────────────────────────────────────────────

export interface NatsResponse<T = unknown> {
  /** Whether the request succeeded */
  success: boolean;
  
  /** W3C trace-context trace ID (mirrored from request) */
  traceId: string;
  
  /** Response payload (present if success is true) */
  data?: T;
  
  /** Error details (present if success is false) */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Request/Reply Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SuspendUserRequest {
  userId: string;
  reason: string;
  suspendedBy: string;
}

export interface SuspendUserResponse {
  userId: string;
  status: string;
  suspendedAt: string;
}

export interface ActivateUserRequest {
  userId: string;
  activatedBy: string;
}

export interface ActivateUserResponse {
  userId: string;
  status: string;
  activatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Request/Reply Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CancelTripRequest {
  tripId: string;
  cancelledBy: 'RIDER' | 'DRIVER' | 'ADMIN';
  reason: string;
}

export interface CancelTripResponse {
  tripId: string;
  status: string;
  cancelledAt: string;
  refundAmount?: number;
}

export interface AssignDriverRequest {
  tripId: string;
  driverId: string;
}

export interface AssignDriverResponse {
  tripId: string;
  driverId: string;
  status: string;
  assignedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Request/Reply Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RefundRequest {
  paymentId: string;
  tripId: string;
  amount: number;
  reason: string;
}

export interface RefundResponse {
  refundId: string;
  paymentId: string;
  amount: number;
  status: string;
  refundedAt: string;
}

export interface AdjustPaymentRequest {
  paymentId: string;
  tripId: string;
  adjustmentAmount: number;
  reason: string;
}

export interface AdjustPaymentResponse {
  paymentId: string;
  originalAmount: number;
  adjustedAmount: number;
  status: string;
  adjustedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

export function createNatsRequest<T>(
  data: T,
  options: {
    traceId: string;
    requestedBy: string;
  }
): NatsRequest<T> {
  return {
    traceId: options.traceId,
    requestedBy: options.requestedBy,
    timestamp: new Date().toISOString(),
    data,
  };
}

export function createSuccessResponse<T>(
  data: T,
  traceId: string
): NatsResponse<T> {
  return {
    success: true,
    traceId,
    data,
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  traceId: string,
  details?: Record<string, unknown>
): NatsResponse {
  return {
    success: false,
    traceId,
    error: {
      code,
      message,
      details,
    },
  };
}
