import { Location, LocationUpdate } from "./location.types";
import { TripStatus } from "./trip.types";

// NATS Event Subjects (pub/sub)
export const NATS_SUBJECTS = {
  // User lifecycle — published by auth-service, consumed by all services needing user data
  USER_CREATED: "ain_rider.user.created",
  USER_UPDATED: "ain_rider.user.updated",
  USER_STATUS_CHANGED: "ain_rider.user.status_changed",
  USER_DELETED: "ain_rider.user.deleted",
  OTP_VERIFIED: "ain_rider.otp.verified",
  DRIVER_APPROVED: "ain_rider.driver.approved",

  LOCATION_UPDATE: "ain_rider.location_update",
  TRIP_REQUESTED: "ain_rider.trip_requested",
  TRIP_ASSIGNED: "ain_rider.trip_assigned",
  TRIP_MATCHED: "ain_rider.trip_matched",
  TRIP_STARTED: "ain_rider.trip_started",
  TRIP_COMPLETED: "ain_rider.trip_completed",
  TRIP_CANCELLED: "ain_rider.trip_cancelled",
  TRIP_REJECTED: "ain_rider.trip_rejected",
  DRIVER_STATUS_CHANGED: "ain_rider.driver_status_changed",
  PAYMENT_PROCESSED: "ain_rider.payment.processed",
  WALLET_UPDATED: "ain_rider.wallet_updated",
  WITHDRAWAL_REQUESTED: "ain_rider.withdrawal_requested",
  WITHDRAWAL_PROCESSED: "ain_rider.withdrawal_processed",
  TRIP_NO_MATCH: "ain_rider.trip_no_match",
  SOS_CREATED: "ain_rider.sos_created",
  SOS_RESOLVED: "ain_rider.sos_resolved",
  COMPLAINT_CREATED: "ain_rider.complaint_created",
  COMPLAINT_UPDATED: "ain_rider.complaint_updated",
  NOTIFICATION_SENT: "ain_rider.notification_sent",
  PROMO_USED: "ain_rider.promo_used",
} as const;

// NATS Request-Reply Subjects (synchronous command pattern)
// Pattern: {domain}.{action}.request — admin-service sends, owning service responds
export const NATS_REQUESTS = {
  // Trip commands — handled by trip-service
  TRIP_CREATE: "trip.create.request",
  TRIP_CANCEL: "trip.cancel.request",
  TRIP_ASSIGN_DRIVER: "trip.assign_driver.request",
  TRIP_UPDATE_STATUS: "trip.update_status.request",

  // Payment commands — handled by payment-service
  PAYMENT_REFUND: "payment.refund.request",
  PAYMENT_ADJUST: "payment.adjust.request",

  // User commands — handled by auth-service
  USER_SUSPEND: "user.suspend.request",
  USER_ACTIVATE: "user.activate.request",
  USER_UPDATE: "user.update.request",
} as const;

// Event Payloads
export interface LocationUpdateEvent {
  readonly type: 'LOCATION_UPDATE';
  subject: typeof NATS_SUBJECTS.LOCATION_UPDATE;
  data: LocationUpdate;
}

export interface TripRequestedEvent {
  readonly type: 'TRIP_REQUESTED';
  subject: typeof NATS_SUBJECTS.TRIP_REQUESTED;
  data: {
    tripId: string;
    riderId: string;
    pickupLocation: Location;
    dropoffLocation: Location;
    /** Optional enrichment from trip-service (match-service only needs locations + tripId) */
    pickupAddress?: string;
    dropoffAddress?: string;
    estimatedFare?: number;
    paymentMethod?: string;
    promoCode?: string | null;
    requestedAt?: string;
    status?: string;
    driverId?: string | null;
  };
}

/** TRIP_MATCHED — match-service sends minimal payload; trip-service may send full snapshot */
export interface TripMatchedEvent {
  readonly type: 'TRIP_MATCHED';
  subject: typeof NATS_SUBJECTS.TRIP_MATCHED;
  data: {
    tripId: string;
    driverId?: string | null;
    estimatedArrival?: number;
    status?: string;
    actualFare?: number | null;
    distance?: number | null;
    duration?: number | null;
    matchedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    cancellationReason?: string | null;
    cancelledBy?: string | null;
    driverRating?: number | null;
    riderRating?: number | null;
    updatedAt?: string;
  };
}

/** TRIP_STARTED | TRIP_COMPLETED | TRIP_CANCELLED — trip-service snapshot */
export interface TripStatusChangedEvent {
  readonly type: 'TRIP_STATUS_CHANGED';
  subject:
    | typeof NATS_SUBJECTS.TRIP_STARTED
    | typeof NATS_SUBJECTS.TRIP_COMPLETED
    | typeof NATS_SUBJECTS.TRIP_CANCELLED;
  data: {
    tripId: string;
    status: TripStatus | string;
    timestamp: Date;
    driverId?: string | null;
    actualFare?: number | null;
    distance?: number | null;
    duration?: number | null;
    matchedAt?: string;
    startedAt?: string;
    completedAt?: string;
    cancelledAt?: string;
    cancellationReason?: string | null;
    cancelledBy?: string | null;
    driverRating?: number | null;
    riderRating?: number | null;
    updatedAt?: string;
  };
}

export interface DriverStatusChangedEvent {
  readonly type: 'DRIVER_STATUS_CHANGED';
  subject: typeof NATS_SUBJECTS.DRIVER_STATUS_CHANGED;
  data: {
    driverId: string;
    isOnline: boolean;
    location?: Location;
  };
}

export interface PaymentProcessedEvent {
  readonly type: 'PAYMENT_PROCESSED';
  subject: typeof NATS_SUBJECTS.PAYMENT_PROCESSED;
  data: {
    tripId: string;
    paymentId: string;
    amount: number;
    status: string;
  };
}

// ── User lifecycle events (auth-service → all) ──────────────────────────────

export interface UserCreatedEvent {
  readonly type: 'USER_CREATED';
  subject: typeof NATS_SUBJECTS.USER_CREATED;
  data: {
    id: string;
    email: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface UserUpdatedEvent {
  readonly type: 'USER_UPDATED';
  subject: typeof NATS_SUBJECTS.USER_UPDATED;
  data: {
    id: string;
    email?: string;
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string | null;
    updatedAt: string;
  };
}

export interface UserStatusChangedEvent {
  readonly type: 'USER_STATUS_CHANGED';
  subject: typeof NATS_SUBJECTS.USER_STATUS_CHANGED;
  data: {
    id: string;
    status: string;
    changedBy?: string;
    updatedAt: string;
  };
}

export interface UserDeletedEvent {
  readonly type: 'USER_DELETED';
  subject: typeof NATS_SUBJECTS.USER_DELETED;
  data: {
    id: string;
    deletedAt: string;
  };
}

export interface OtpVerifiedEvent {
  readonly type: 'OTP_VERIFIED';
  subject: typeof NATS_SUBJECTS.OTP_VERIFIED;
  data: {
    phoneNumber: string;
    uid: string;
    verifiedAt: string;
  };
}

export interface DriverApprovedEvent {
  readonly type: 'DRIVER_APPROVED';
  subject: typeof NATS_SUBJECTS.DRIVER_APPROVED;
  data: {
    driverId: string;
    userId: string;
    approvedAt: string;
    approvedBy?: string;
  };
}

export interface NotificationSentEvent {
  readonly type: 'NOTIFICATION_SENT';
  subject: typeof NATS_SUBJECTS.NOTIFICATION_SENT;
  data: {
    userId: string;
    title: string;
    body: string;
    notificationId?: string;
    data?: Record<string, unknown>;
  };
}

export type NatsEvent =
  | LocationUpdateEvent
  | TripRequestedEvent
  | TripMatchedEvent
  | TripStatusChangedEvent
  | DriverStatusChangedEvent
  | PaymentProcessedEvent
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserStatusChangedEvent
  | UserDeletedEvent
  | NotificationSentEvent
  | OtpVerifiedEvent
  | DriverApprovedEvent;

export type NatsEventType = NatsEvent['type'];

export function validateEvent<T>(data: unknown, requiredFields: string[]): data is T {
  if (typeof data !== 'object' || data === null) return false;
  for (const field of requiredFields) {
    if (!(field in data)) return false;
  }
  return true;
}

export function isNatsEvent(data: unknown): data is NatsEvent {
  return validateEvent<NatsEvent>(data, ['type', 'subject', 'data']);
}

type FieldSpec = { name: string; type: 'string' | 'number' | 'boolean' | 'object' | 'array' };

function validateFields(data: unknown, fields: FieldSpec[]): { valid: boolean; missing: string[] } {
  if (typeof data !== 'object' || data === null) return { valid: false, missing: ['root'] };
  const obj = data as Record<string, unknown>;
  const missing: string[] = [];
  for (const field of fields) {
    const val = obj[field.name];
    if (val === undefined || val === null) { missing.push(field.name); continue; }
    switch (field.type) {
      case 'string': if (typeof val !== 'string') missing.push(field.name); break;
      case 'number': if (typeof val !== 'number') missing.push(field.name); break;
      case 'boolean': if (typeof val !== 'boolean') missing.push(field.name); break;
      case 'object': if (typeof val !== 'object' || val === null) missing.push(field.name); break;
      case 'array': if (!Array.isArray(val)) missing.push(field.name); break;
    }
  }
  return { valid: missing.length === 0, missing };
}

export const EventValidators = {
  USER_CREATED: (data: unknown) => validateFields(data, [
    { name: 'id', type: 'string' }, { name: 'email', type: 'string' },
    { name: 'phoneNumber', type: 'string' }, { name: 'role', type: 'string' },
    { name: 'status', type: 'string' }, { name: 'createdAt', type: 'string' },
  ]),
  USER_UPDATED: (data: unknown) => validateFields(data, [
    { name: 'id', type: 'string' }, { name: 'updatedAt', type: 'string' },
  ]),
  USER_STATUS_CHANGED: (data: unknown) => validateFields(data, [
    { name: 'id', type: 'string' }, { name: 'status', type: 'string' },
    { name: 'updatedAt', type: 'string' },
  ]),
  USER_DELETED: (data: unknown) => validateFields(data, [
    { name: 'id', type: 'string' }, { name: 'deletedAt', type: 'string' },
  ]),
  LOCATION_UPDATE: (data: unknown) => validateFields(data, [
    { name: 'driverId', type: 'string' },
  ]),
  TRIP_REQUESTED: (data: unknown) => validateFields(data, [
    { name: 'tripId', type: 'string' }, { name: 'riderId', type: 'string' },
  ]),
  TRIP_MATCHED: (data: unknown) => validateFields(data, [
    { name: 'tripId', type: 'string' },
  ]),
  TRIP_STARTED: (data: unknown) => validateFields(data, [
    { name: 'tripId', type: 'string' },
  ]),
  TRIP_COMPLETED: (data: unknown) => validateFields(data, [
    { name: 'tripId', type: 'string' }, { name: 'riderId', type: 'string' },
    { name: 'driverId', type: 'string' },
  ]),
  TRIP_CANCELLED: (data: unknown) => validateFields(data, [
    { name: 'tripId', type: 'string' }, { name: 'riderId', type: 'string' },
  ]),
  DRIVER_STATUS_CHANGED: (data: unknown) => validateFields(data, [
    { name: 'driverId', type: 'string' }, { name: 'isOnline', type: 'boolean' },
  ]),
  PAYMENT_PROCESSED: (data: unknown) => validateFields(data, [
    { name: 'tripId', type: 'string' }, { name: 'paymentId', type: 'string' },
    { name: 'amount', type: 'number' },
  ]),
  NOTIFICATION_SENT: (data: unknown) => validateFields(data, [
    { name: 'userId', type: 'string' }, { name: 'title', type: 'string' },
    { name: 'body', type: 'string' },
  ]),
  SOS_CREATED: (data: unknown) => validateFields(data, [
    { name: 'sosId', type: 'string' }, { name: 'userId', type: 'string' },
  ]),
  SOS_RESOLVED: (data: unknown) => validateFields(data, [
    { name: 'sosId', type: 'string' }, { name: 'resolvedBy', type: 'string' },
  ]),
} as const;
