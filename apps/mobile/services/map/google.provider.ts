import { MapProvider } from './map.provider';

export class GoogleMapProvider implements MapProvider {
  async getRoute() {
    throw new Error('Google provider not implemented');
  }
  async geocode() {
    throw new Error('Google provider not implemented');
  }
  async reverseGeocode() {
    throw new Error('Google provider not implemented');
  }
  async searchPlaces() {
    throw new Error('Google provider not implemented');
  }
}
