import { ApiClient } from './client';

interface RegisterAvailableResponse {
  success: boolean;
  message?: string;
}

interface UnregisterAvailableResponse {
  success: boolean;
}

interface RespondToTripResponse {
  success: boolean;
  tripId: string;
  action: 'accept' | 'reject';
}

interface NearbyDriver {
  id: string;
  lat: number;
  lng: number;
}

export type { RegisterAvailableResponse, UnregisterAvailableResponse, RespondToTripResponse, NearbyDriver };

export const MatchApi = {
  async registerAvailable(data: {
    latitude: number;
    longitude: number;
    vehicleTypeId: string;
    driverName?: string;
    driverPhone?: string;
    driverRating?: number;
    vehicleMake?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
  }): Promise<RegisterAvailableResponse> {
    return ApiClient.post<RegisterAvailableResponse>('/match/available', data);
  },

  async unregisterAvailable(): Promise<UnregisterAvailableResponse> {
    return ApiClient.post<UnregisterAvailableResponse>('/match/unavailable');
  },

  async respondToTrip(tripId: string, action: 'accept' | 'reject'): Promise<RespondToTripResponse> {
    return ApiClient.post<RespondToTripResponse>(`/match/respond`, { tripId, action });
  },

  async getNearbyDrivers(lat: number, lng: number): Promise<NearbyDriver[]> {
    return ApiClient.get<NearbyDriver[]>(`/match/nearby?latitude=${lat}&longitude=${lng}`);
  },
};
