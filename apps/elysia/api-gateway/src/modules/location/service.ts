import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

const LOCATION_SERVICE_URL = process.env.LOCATION_SERVICE_URL || 'http://location-service:3002';

export abstract class LocationProxyService {
  static async getNearbyDrivers(latitude: number, longitude: number): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'location-service', status: 'attempt' });
    try {
      const res = await fetch(
        `${LOCATION_SERVICE_URL}/location/nearby?latitude=${latitude}&longitude=${longitude}`,
      );
      proxyRequestsTotal.inc({ service: 'location-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'location-service', status: 'failed' });
      log('error', 'Location service nearby proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async updateDriverLocation(
    userId: string,
    body: { latitude: number; longitude: number; heading?: number; speed?: number },
  ): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'location-service', status: 'attempt' });
    try {
      const res = await fetch(`${LOCATION_SERVICE_URL}/location/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ ...body, driverId: userId }),
      });
      proxyRequestsTotal.inc({ service: 'location-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'location-service', status: 'failed' });
      log('error', 'Location service update proxy failed', { error: String(error) });
      throw error;
    }
  }
}
