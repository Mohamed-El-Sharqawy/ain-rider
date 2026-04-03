import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';
import type { TripRequestBody, EstimateRequestBody } from './model';

const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://trip-service:4001';

function proxyResponse(res: Response) {
  proxyRequestsTotal.inc({ service: 'trip-service', status: res.ok ? 'success' : 'error' });
  return res;
}

export abstract class TripProxyService {
  static async requestTrip(body: TripRequestBody, userId: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const tripBody = {
        riderId: userId,
        pickupLat: body.pickupLatitude,
        pickupLng: body.pickupLongitude,
        pickupAddress: body.pickupAddress,
        dropoffLat: body.dropoffLatitude,
        dropoffLng: body.dropoffLongitude,
        dropoffAddress: body.dropoffAddress,
        estimatedFare: body.estimatedFare,
        paymentMethod: body.paymentMethod ?? 'CASH',
        promoCode: body.promoCode,
      };
      const res = await fetch(`${TRIP_SERVICE_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(tripBody),
      });
      return proxyResponse(res);
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
      return proxyResponse(res);
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
        body: JSON.stringify({ reason, cancelledBy: 'RIDER' }), // Gateway handles the 'cancelledBy' for the rider-facing API
      });
      return proxyResponse(res);
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service cancel proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async estimateFare(body: EstimateRequestBody): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const res = await fetch(`${TRIP_SERVICE_URL}/trips/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLat: body.pickupLatitude,
          pickupLng: body.pickupLongitude,
          dropoffLat: body.dropoffLatitude,
          dropoffLng: body.dropoffLongitude,
        }),
      });
      return proxyResponse(res);
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service estimate proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async updateStatus(tripId: string, status: string, driverId: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const res = await fetch(`${TRIP_SERVICE_URL}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': driverId },
        body: JSON.stringify({ status, driverId }),
      });
      return proxyResponse(res);
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service status update proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async rejectTrip(tripId: string, driverId: string, reason?: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'trip-service', status: 'attempt' });
    try {
      const res = await fetch(`${TRIP_SERVICE_URL}/trips/${tripId}/reject`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          'x-user-id': driverId,
          'x-driver-id': driverId 
        },
        body: JSON.stringify({ reason }),
      });
      return proxyResponse(res);
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'trip-service', status: 'failed' });
      log('error', 'Trip service reject proxy failed', { error: String(error) });
      throw error;
    }
  }
}
