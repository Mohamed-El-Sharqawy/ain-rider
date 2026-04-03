export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
}

export interface GeocodingResult {
  placeId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type?: string;
}

export interface MapProvider {
  getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult>;
  geocode(address: string): Promise<GeocodingResult[]>;
  reverseGeocode(location: LatLng): Promise<string>;
  searchPlaces(query: string, near?: LatLng): Promise<GeocodingResult[]>;
}
