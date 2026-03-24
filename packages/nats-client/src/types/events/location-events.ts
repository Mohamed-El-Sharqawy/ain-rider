/**
 * Location Event Payloads
 * 
 * Events for real-time location updates
 */

// ─────────────────────────────────────────────────────────────────────────────
// Location Update - Published by location-service for driver GPS
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationUpdatePayload {
  driverId: string;
  location: {
    lat: number;
    lng: number;
  };
  heading?: number; // degrees 0-360
  speed?: number; // km/h
  accuracy?: number; // meters
  timestamp: string;
  tripId?: string | null; // if driver is on a trip
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver Status Changed - Published when driver goes online/offline
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverStatusChangedPayload {
  driverId: string;
  isOnline: boolean;
  location?: {
    lat: number;
    lng: number;
  } | null;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type LocationUpdateEvent = LocationUpdatePayload;
export type DriverStatusChangedEvent = DriverStatusChangedPayload;
