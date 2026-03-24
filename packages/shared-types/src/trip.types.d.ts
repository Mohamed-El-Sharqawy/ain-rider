import { Coordinates } from './location.types';
export declare enum TripStatus {
    REQUESTED = "REQUESTED",
    MATCHED = "MATCHED",
    DRIVER_ARRIVING = "DRIVER_ARRIVING",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}
export declare enum PaymentMethod {
    CASH = "CASH",
    CARD = "CARD",
    WALLET = "WALLET"
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
    distance?: number;
    duration?: number;
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
//# sourceMappingURL=trip.types.d.ts.map