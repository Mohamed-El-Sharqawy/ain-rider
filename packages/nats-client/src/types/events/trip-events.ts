/**
 * Trip Event Payloads
 * 
 * Events for trip lifecycle: requested → matched → started → completed/cancelled
 */


export interface Location {
  lat: number;
  lng: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Requested - Published by trip-service when rider requests a trip
// ─────────────────────────────────────────────────────────────────────────────

export interface TripRequestedPayload {
  tripId: string;
  riderId: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  paymentMethod: string;
  promoCode?: string | null;
  requestedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Matched - Published by match-service when driver accepts
// ─────────────────────────────────────────────────────────────────────────────

export interface TripMatchedPayload {
  tripId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverRating: number;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  estimatedArrival: number; // minutes
  distance: number; // meters
  matchedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip No Match - Published by match-service when no driver available
// ─────────────────────────────────────────────────────────────────────────────

export interface TripNoMatchPayload {
  tripId: string;
  riderId: string;
  reason: 'NO_DRIVERS_AVAILABLE' | 'ALL_DRIVERS_BUSY' | 'SEARCH_TIMEOUT';
  searchedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Started - Published by trip-service when ride begins
// ─────────────────────────────────────────────────────────────────────────────

export interface TripStartedPayload {
  tripId: string;
  driverId: string;
  riderId: string;
  startedAt: string;
  pickupLocation: Location;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Completed - Published by trip-service when ride ends
// ─────────────────────────────────────────────────────────────────────────────

export interface TripCompletedPayload {
  tripId: string;
  driverId: string;
  riderId: string;
  actualFare: number;
  distance: number; // meters
  duration: number; // seconds
  completedAt: string;
  pickupLocation: Location;
  dropoffLocation: Location;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Cancelled - Published by trip-service when cancelled
// ─────────────────────────────────────────────────────────────────────────────

export interface TripCancelledPayload {
  tripId: string;
  driverId: string | null;
  riderId: string;
  cancelledBy: 'RIDER' | 'DRIVER' | 'SYSTEM';
  cancellationReason: string;
  cancelledAt: string;
  refundAmount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type TripRequestedEvent = TripRequestedPayload;
export type TripMatchedEvent = TripMatchedPayload;
export type TripNoMatchEvent = TripNoMatchPayload;
export type TripStartedEvent = TripStartedPayload;
export type TripCompletedEvent = TripCompletedPayload;
export type TripCancelledEvent = TripCancelledPayload;
