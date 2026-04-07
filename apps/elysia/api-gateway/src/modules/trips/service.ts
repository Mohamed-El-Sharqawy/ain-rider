import { fetchInternal } from '@ain-rider/internal-api';
import type { TripRequestBody, EstimateRequestBody } from './model';

const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || 'http://trip-service:4001';

export abstract class TripProxyService {
  static async requestTrip(body: TripRequestBody, userId: string): Promise<Response> {
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
    return fetchInternal(`${TRIP_SERVICE_URL}/trips`, 'POST', tripBody, {
      targetService: 'trip-service',
      headers: { 'x-user-id': userId },
    });
  }

  static async getTrip(tripId: string, userId: string): Promise<Response> {
    return fetchInternal(`${TRIP_SERVICE_URL}/trips/${tripId}`, 'GET', undefined, {
      targetService: 'trip-service',
      headers: { 'x-user-id': userId },
    });
  }

  static async cancelTrip(tripId: string, userId: string, reason: string): Promise<Response> {
    return fetchInternal(`${TRIP_SERVICE_URL}/trips/${tripId}/cancel`, 'PATCH', { reason, cancelledBy: 'RIDER' }, {
      targetService: 'trip-service',
      headers: { 'x-user-id': userId },
    });
  }

  static async estimateFare(body: EstimateRequestBody): Promise<Response> {
    return fetchInternal(`${TRIP_SERVICE_URL}/trips/estimate`, 'POST', {
      pickupLat: body.pickupLatitude,
      pickupLng: body.pickupLongitude,
      dropoffLat: body.dropoffLatitude,
      dropoffLng: body.dropoffLongitude,
    }, {
      targetService: 'trip-service',
    });
  }

  static async updateStatus(tripId: string, status: string, driverId: string): Promise<Response> {
    return fetchInternal(`${TRIP_SERVICE_URL}/trips/${tripId}/status`, 'PATCH', { status, driverId }, {
      targetService: 'trip-service',
      headers: { 'x-user-id': driverId },
    });
  }

  static async rateTrip(tripId: string, userId: string, ratedBy: 'rider' | 'driver', rating: number): Promise<Response> {
    return fetchInternal(`${TRIP_SERVICE_URL}/trips/${tripId}/rate`, 'PATCH', { ratedBy, rating }, {
      targetService: 'trip-service',
      headers: { 'x-user-id': userId },
    });
  }

  static async rejectTrip(tripId: string, driverId: string, reason?: string): Promise<Response> {
    return fetchInternal(`${TRIP_SERVICE_URL}/trips/${tripId}/reject`, 'PATCH', { reason }, {
      targetService: 'trip-service',
      headers: { 'x-user-id': driverId, 'x-driver-id': driverId },
    });
  }

  static async getUserTrips(userId: string, role: string): Promise<Response> {
    const queryParam = role === 'DRIVER' ? `driverId=${userId}` : `riderId=${userId}`;
    return fetchInternal(`${TRIP_SERVICE_URL}/trips?${queryParam}`, 'GET', undefined, {
      targetService: 'trip-service',
      headers: { 'x-user-id': userId },
    });
  }
}
