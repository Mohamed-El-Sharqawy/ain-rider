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
}
export interface GeoFence {
    id: string;
    name: string;
    center: Coordinates;
    radiusMeters: number;
}
//# sourceMappingURL=location.types.d.ts.map