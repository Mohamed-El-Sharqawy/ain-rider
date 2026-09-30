export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends Coordinates {
  timestamp: Date;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

export interface LocationUpdate {
  driverId: string;
  location: Location;
  h3Index: string;
  distanceMeters?: number; // OSRM distance to destination
  durationSeconds?: number; // OSRM duration to destination
}

export interface GeoFence {
  id: string;
  name: string;
  center: Coordinates;
  radiusMeters: number;
}

/** Calculates the haversine distance in meters between two geographic coordinates. */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}
