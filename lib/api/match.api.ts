import { ApiClient } from './client';

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
  }): Promise<any> {
    return ApiClient.post<any>('/match/available', data);
  },

  async unregisterAvailable(): Promise<any> {
    return ApiClient.post<any>('/match/unavailable');
  },

  async getNearbyDrivers(lat: number, lng: number): Promise<Array<{ id: string; lat: number; lng: number }>> {
    return ApiClient.get<Array<{ id: string; lat: number; lng: number }>>(`/match/nearby?latitude=${lat}&longitude=${lng}`);
  },
};
