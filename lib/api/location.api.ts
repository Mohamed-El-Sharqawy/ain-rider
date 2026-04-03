import { ApiClient } from './client';
import { NearbyDriversResponse } from './types';

export const LocationApi = {
  async getNearbyDrivers(
    latitude: number,
    longitude: number,
  ): Promise<NearbyDriversResponse> {
    return ApiClient.get<NearbyDriversResponse>(
      `/location/nearby?latitude=${latitude}&longitude=${longitude}`,
    );
  },

  async updateDriverLocation(data: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  }): Promise<{ success: boolean; h3Index: string }> {
    return ApiClient.post<{ success: boolean; h3Index: string }>(
      '/location/update',
      data,
    );
  },
};
