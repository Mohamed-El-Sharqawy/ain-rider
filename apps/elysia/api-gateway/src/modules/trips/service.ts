import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';
import type { TripRequestBody } from './model';

const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://trip-service:4001';

export abstract class TripProxyService {
  static async requestTrip(body: TripRequestBody, userId: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const res = await fetch(`${TRIP_SERVICE_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ ...body, riderId: userId }),
      });
      proxyRequestsTotal.inc({ service: 'trip-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async getTrip(tripId: string, userId: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const res = await fetch(`${TRIP_SERVICE_URL}/trips/${tripId}`, {
        headers: { 'x-user-id': userId },
      });
      proxyRequestsTotal.inc({ service: 'trip-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service get proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async cancelTrip(tripId: string, userId: string, reason: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const res = await fetch(`${TRIP_SERVICE_URL}/trips/${tripId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ reason }),
      });
      proxyRequestsTotal.inc({ service: 'trip-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service cancel proxy failed', { error: String(error) });
      throw error;
    }
  }
}
