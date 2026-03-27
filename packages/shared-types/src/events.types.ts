import { Location, LocationUpdate } from './location.types';
import { TripStatus } from './trip.types';

// NATS Event Subjects (pub/sub)
export const NATS_SUBJECTS = {
  // User lifecycle — published by auth-service, consumed by all services needing user data
  USER_CREATED: 'ain_rider.user_created',
  USER_UPDATED: 'ain_rider.user_updated',
  USER_STATUS_CHANGED: 'ain_rider.user_status_changed',
  USER_DELETED: 'ain_rider.user_deleted',
  OTP_VERIFIED: 'ain_rider.otp_verified',

  LOCATION_UPDATE: 'ain_rider.location_update',
  TRIP_REQUESTED: 'ain_rider.trip_requested',
  TRIP_MATCHED: 'ain_rider.trip_matched',
  TRIP_STARTED: 'ain_rider.trip_started',
  TRIP_COMPLETED: 'ain_rider.trip_completed',
  TRIP_CANCELLED: 'ain_rider.trip_cancelled',
  DRIVER_STATUS_CHANGED: 'ain_rider.driver_status_changed',
  PAYMENT_PROCESSED: 'ain_rider.payment_processed',
  WALLET_UPDATED: 'ain_rider.wallet_updated',
  WITHDRAWAL_REQUESTED: 'ain_rider.withdrawal_requested',
  WITHDRAWAL_PROCESSED: 'ain_rider.withdrawal_processed',
  SOS_CREATED: 'ain_rider.sos_created',
  SOS_RESOLVED: 'ain_rider.sos_resolved',
  COMPLAINT_CREATED: 'ain_rider.complaint_created',
  COMPLAINT_UPDATED: 'ain_rider.complaint_updated',
  NOTIFICATION_SENT: 'ain_rider.notification_sent',
  PROMO_USED: 'ain_rider.promo_used',
} as const;

// NATS Request-Reply Subjects (synchronous command pattern)
// Pattern: {domain}.{action}.request — admin-service sends, owning service responds
export const NATS_REQUESTS = {
  // Trip commands — handled by trip-service
  TRIP_CREATE: 'trip.create.request',
  TRIP_CANCEL: 'trip.cancel.request',
  TRIP_ASSIGN_DRIVER: 'trip.assign_driver.request',
  TRIP_UPDATE_STATUS: 'trip.update_status.request',

  // Payment commands — handled by payment-service
  PAYMENT_REFUND: 'payment.refund.request',
  PAYMENT_ADJUST: 'payment.adjust.request',

  // User commands — handled by auth-service
  USER_SUSPEND: 'user.suspend.request',
  USER_ACTIVATE: 'user.activate.request',
  USER_UPDATE: 'user.update.request',
} as const;

// Event Payloads
export interface LocationUpdateEvent {
  subject: typeof NATS_SUBJECTS.LOCATION_UPDATE;
  data: LocationUpdate;
}

export interface TripRequestedEvent {
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
  subject: typeof NATS_SUBJECTS.DRIVER_STATUS_CHANGED;
  data: {
    driverId: string;
    isOnline: boolean;
    location?: Location;
  };
}

export interface PaymentProcessedEvent {
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
  subject: typeof NATS_SUBJECTS.USER_STATUS_CHANGED;
  data: {
    id: string;
    status: string;
    changedBy?: string;
    updatedAt: string;
  };
}

export interface UserDeletedEvent {
  subject: typeof NATS_SUBJECTS.USER_DELETED;
  data: {
    id: string;
    deletedAt: string;
  };
}

export interface OtpVerifiedEvent {
  subject: typeof NATS_SUBJECTS.OTP_VERIFIED;
  data: {
    phoneNumber: string;
    uid: string;
    verifiedAt: string;
  };
}

export interface NotificationSentEvent {
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
  | OtpVerifiedEvent;
