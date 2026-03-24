import { Location, LocationUpdate } from './location.types';
import { TripStatus } from './trip.types';
export declare const NATS_SUBJECTS: {
    readonly LOCATION_UPDATE: "ain_rider.location_update";
    readonly TRIP_REQUESTED: "ain_rider.trip_requested";
    readonly TRIP_MATCHED: "ain_rider.trip_matched";
    readonly TRIP_STARTED: "ain_rider.trip_started";
    readonly TRIP_COMPLETED: "ain_rider.trip_completed";
    readonly TRIP_CANCELLED: "ain_rider.trip_cancelled";
    readonly DRIVER_STATUS_CHANGED: "ain_rider.driver_status_changed";
    readonly PAYMENT_PROCESSED: "ain_rider.payment_processed";
    readonly WALLET_UPDATED: "ain_rider.wallet_updated";
    readonly WITHDRAWAL_REQUESTED: "ain_rider.withdrawal_requested";
    readonly WITHDRAWAL_PROCESSED: "ain_rider.withdrawal_processed";
    readonly SOS_CREATED: "ain_rider.sos_created";
    readonly SOS_RESOLVED: "ain_rider.sos_resolved";
    readonly COMPLAINT_CREATED: "ain_rider.complaint_created";
    readonly COMPLAINT_UPDATED: "ain_rider.complaint_updated";
    readonly NOTIFICATION_SENT: "ain_rider.notification_sent";
    readonly PROMO_USED: "ain_rider.promo_used";
};
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
    };
}
export interface TripMatchedEvent {
    subject: typeof NATS_SUBJECTS.TRIP_MATCHED;
    data: {
        tripId: string;
        driverId: string;
        estimatedArrival: number;
    };
}
export interface TripStatusChangedEvent {
    subject: typeof NATS_SUBJECTS.TRIP_STARTED | typeof NATS_SUBJECTS.TRIP_COMPLETED | typeof NATS_SUBJECTS.TRIP_CANCELLED;
    data: {
        tripId: string;
        status: TripStatus;
        timestamp: Date;
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
export type NatsEvent = LocationUpdateEvent | TripRequestedEvent | TripMatchedEvent | TripStatusChangedEvent | DriverStatusChangedEvent | PaymentProcessedEvent;
//# sourceMappingURL=events.types.d.ts.map