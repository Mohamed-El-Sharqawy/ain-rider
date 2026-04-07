import { fetchInternal } from '@ain-rider/internal-api';

const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://location-service:3002';

export abstract class LocationProxyService {
  static async getNearbyDrivers(latitude: number, longitude: number): Promise<Response> {
    return fetchInternal(`${LOCATION_SERVICE_URL}/location/nearby?latitude=${latitude}&longitude=${longitude}`, 'GET', undefined, {
      targetService: 'location-service',
    });
  }

  static async updateDriverLocation(
    userId: string,
    body: { latitude: number; longitude: number; heading?: number; speed?: number },
  ): Promise<Response> {
    return fetchInternal(`${LOCATION_SERVICE_URL}/location/update`, 'POST', { ...body, driverId: userId }, {
      targetService: 'location-service',
      headers: { 'x-user-id': userId },
    });
  }
}
