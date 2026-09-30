import { fetchInternal } from '@ain-rider/internal-api';

const MATCH_SERVICE_URL = process.env.MATCH_SERVICE_URL || 'http://localhost:3003';

export abstract class MatchProxyService {
  static async registerAvailable(
    userId: string,
    body: {
      latitude: number;
      longitude: number;
      vehicleTypeId: string;
      driverName?: string;
      driverPhone?: string;
      driverRating?: number;
      vehicleMake?: string;
      vehicleModel?: string;
      vehiclePlate?: string;
    },
  ): Promise<Response> {
    return fetchInternal(`${MATCH_SERVICE_URL}/driver/available`, 'POST', { ...body, driverId: userId }, {
      targetService: 'match-service',
      headers: { 'x-user-id': userId },
    });
  }

  static async unregisterAvailable(userId: string): Promise<Response> {
    return fetchInternal(`${MATCH_SERVICE_URL}/driver/unavailable`, 'POST', { driverId: userId }, {
      targetService: 'match-service',
      headers: { 'x-user-id': userId },
    });
  }

  static async respondToTrip(tripId: string, driverId: string, action: string): Promise<Response> {
    return fetchInternal(`${MATCH_SERVICE_URL}/driver/respond`, 'POST', { tripId, action, driverId }, {
      targetService: 'match-service',
      headers: { 'x-user-id': driverId },
    });
  }

  static async getNearbyDrivers(userId: string, lat: number, lng: number): Promise<Response> {
    return fetchInternal(`${MATCH_SERVICE_URL}/driver/nearby?latitude=${lat}&longitude=${lng}`, 'GET', undefined, {
      targetService: 'match-service',
      headers: { 'x-user-id': userId },
    });
  }
}
