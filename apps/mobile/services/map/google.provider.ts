import {
  GeocodingResult,
  LatLng,
  MapProvider,
  RouteResult,
} from "./map.provider";

export class GoogleMapProvider implements MapProvider {
  async getRoute(_origin: LatLng, _destination: LatLng): Promise<RouteResult> {
    throw new Error("Google provider not implemented");
  }
  async geocode(_address: string): Promise<GeocodingResult[]> {
    throw new Error("Google provider not implemented");
  }
  async reverseGeocode(_location: LatLng): Promise<string> {
    throw new Error("Google provider not implemented");
  }
  async searchPlaces(
    _query: string,
    _near?: LatLng,
  ): Promise<GeocodingResult[]> {
    throw new Error("Google provider not implemented");
  }
}
