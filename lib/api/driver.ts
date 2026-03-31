import { ApiClient } from './client';
import {
  UpdateDriverProfilePayload,
  OnboardingStatusResponse,
  VehicleRegistrationPayload,
  VehicleRegistrationResponse,
  VehicleMake,
  VehicleModel
} from './types';

export const DriverApi = {
  async getOnboardingStatus(): Promise<OnboardingStatusResponse> {
    return ApiClient.get<OnboardingStatusResponse>('/auth/driver/onboarding-status');
  },

  async updateProfile(data: UpdateDriverProfilePayload): Promise<{ success: boolean; data: any }> {
    return ApiClient.patch<{ success: boolean; data: any }>('/auth/driver/profile', data);
  },

  async updateStatus(isOnline: boolean): Promise<{ success: boolean; data: any }> {
    return ApiClient.patch<{ success: boolean; data: any }>('/auth/driver/status', { isOnline });
  },

  async uploadIdentityDocuments(
    frontUri: string,
    backUri: string,
    selfieUri: string
  ): Promise<any> {
    const frontType = frontUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const backType = backUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const selfieType = selfieUri.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return ApiClient.uploadFiles<any>('/auth/driver/documents/identity', [
      { fieldname: 'file1', uri: frontUri, type: frontType, name: 'id_front.jpg' },
      { fieldname: 'file2', uri: backUri, type: backType, name: 'id_back.jpg' },
      { fieldname: 'file3', uri: selfieUri, type: selfieType, name: 'selfie.jpg' },
    ]);
  },

  async uploadDrivingLicense(
    licenseNumber: string,
    frontUri: string,
    backUri: string
  ): Promise<any> {
    const frontType = frontUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const backType = backUri.endsWith('.png') ? 'image/png' : 'image/jpeg';

    // IMPORTANT: licenseNumber must be sent as a field in the multipart form
    return ApiClient.uploadFiles<any>('/auth/driver/documents/driving-license', [
      { fieldname: 'licenseNumber', value: licenseNumber }, // Assuming uploadFiles handles fields or we use a multipart form
      { fieldname: 'file1', uri: frontUri, type: frontType, name: 'license_front.jpg' },
      { fieldname: 'file2', uri: backUri, type: backType, name: 'license_back.jpg' },
    ]);
  },

  async registerVehicle(
    vehicle: VehicleRegistrationPayload,
    carUri: string,
    carLicenseUri: string
  ): Promise<VehicleRegistrationResponse> {
    const carType = carUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const carLicenseType = carLicenseUri.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return ApiClient.uploadFiles<VehicleRegistrationResponse>('/auth/driver/vehicle', [
      { fieldname: 'make', value: vehicle.make },
      { fieldname: 'model', value: vehicle.model },
      { fieldname: 'year', value: vehicle.year.toString() },
      { fieldname: 'color', value: vehicle.color },
      { fieldname: 'plateNumber', value: vehicle.plateNumber },
      { fieldname: 'carImage', uri: carUri, type: carType, name: 'car.jpg' },
      { fieldname: 'carLicenseImage', uri: carLicenseUri, type: carLicenseType, name: 'car_license.jpg' },
    ]);
  },

  async getMakes(): Promise<VehicleMake[]> {
    return ApiClient.get<VehicleMake[]>('/admin/catalog/makes');
  },

  async getModels(makeId: string): Promise<VehicleModel[]> {
    return ApiClient.get<VehicleModel[]>(`/admin/catalog/models?makeId=${makeId}`);
  }
};
