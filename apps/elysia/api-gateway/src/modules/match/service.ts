import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

const MATCH_SERVICE_URL = process.env.MATCH_SERVICE_URL || 'http://match-service:3003';

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
    proxyRequestsTotal.inc({ service: 'match-service', status: 'attempt' });
    try {
      const res = await fetch(`${MATCH_SERVICE_URL}/driver/available`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ ...body, driverId: userId }),
      });
      proxyRequestsTotal.inc({ service: 'match-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'match-service', status: 'failed' });
      log('error', 'Match service available proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async unregisterAvailable(userId: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'match-service', status: 'attempt' });
    try {
      const res = await fetch(`${MATCH_SERVICE_URL}/driver/unavailable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ driverId: userId }),
      });
      proxyRequestsTotal.inc({ service: 'match-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'match-service', status: 'failed' });
      log('error', 'Match service unavailable proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async getNearbyDrivers(userId: string, lat: number, lng: number): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'match-service', status: 'attempt' });
    try {
      const res = await fetch(`${MATCH_SERVICE_URL}/driver/nearby?latitude=${lat}&longitude=${lng}`, {
        headers: { 'x-user-id': userId },
      });
      proxyRequestsTotal.inc({ service: 'match-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'match-service', status: 'failed' });
      log('error', 'Match service nearby proxy failed', { error: String(error) });
      throw error;
    }
  }
}
