import { Coordinates } from './location.types';

export enum TripStatus {
  REQUESTED = 'REQUESTED',
  ASSIGNED = 'ASSIGNED',
  MATCHED = 'MATCHED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  // CARD and WALLET are planned for future implementation
  // Currently only CASH is supported
  // CARD = 'CARD',
  // WALLET = 'WALLET',
}

// Trip payment status (for cash payments)
export enum TripPaymentStatus {
  PENDING = 'PENDING',
  COLLECTED = 'COLLECTED',
  FAILED = 'FAILED',
}

export interface Trip {
  id: string;
  riderId: string;
  driverId?: string;
  status: TripStatus;
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  actualFare?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: TripPaymentStatus;
  distance?: number; // meters
  duration?: number; // seconds
  requestedAt: Date;
  matchedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface TripRequest {
  riderId: string;
  pickupLocation: Coordinates;
  dropoffLocation: Coordinates;
  pickupAddress: string;
  dropoffAddress: string;
  paymentMethod: PaymentMethod;
}
