import { ApiClient } from './client';
import { TripResponse, FareEstimate } from './types';

export const TripApi = {
  async createTrip(data: {
    pickupLatitude: number;
    pickupLongitude: number;
    pickupAddress: string;
    dropoffLatitude: number;
    dropoffLongitude: number;
    dropoffAddress: string;
    estimatedFare: number;
    paymentMethod?: string;
  }): Promise<TripResponse> {
    return ApiClient.post<TripResponse>('/trips', data);
  },

  async getTrip(tripId: string): Promise<TripResponse> {
    return ApiClient.get<TripResponse>(`/trips/${tripId}`);
  },

  async cancelTrip(tripId: string, reason: string): Promise<{ success: boolean }> {
    return ApiClient.patch<{ success: boolean }>(`/trips/${tripId}/cancel`, { reason });
  },

  async rateTrip(
    tripId: string,
    rating: number,
    ratedBy: 'rider' | 'driver',
  ): Promise<any> {
    return ApiClient.patch<any>(`/trips/${tripId}/rate`, { ratedBy, rating });
  },

  async estimateFare(data: {
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffLatitude: number;
    dropoffLongitude: number;
  }): Promise<FareEstimate> {
    return ApiClient.post<FareEstimate>('/trips/estimate', data);
  },

  async getMyTrips(): Promise<TripResponse[]> {
    return ApiClient.get<TripResponse[]>('/trips');
  },

  async updateTripStatus(
    tripId: string,
    status: string,
  ): Promise<TripResponse> {
    return ApiClient.patch<TripResponse>(`/trips/${tripId}/status`, { status });
  },

  async rejectTrip(tripId: string, reason?: string): Promise<{ success: boolean }> {
    return ApiClient.patch<{ success: boolean }>(`/trips/${tripId}/reject`, { reason });
  },
  
  async acceptTrip(tripId: string): Promise<TripResponse> {
    return ApiClient.patch<TripResponse>(`/trips/${tripId}/accept`, {});
  },
};
