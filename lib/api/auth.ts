import { ApiClient } from './client';
import { OtpRequestPayload, OtpVerifyPayload, PhoneVerificationResult, RegisterPayload, RegisterResponse, IdentityUploadResponse, LoginPayload, LoginResponse, ProfileImageResponse, MeResponse, OnboardingStatusResponse } from './types';

export const AuthApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const payload: LoginPayload = { email, password };
    return ApiClient.post<LoginResponse>('/auth/login', payload);
  },

  async requestOtp(phone: string): Promise<void> {
    const payload: OtpRequestPayload = { phone };
    await ApiClient.post('/auth/request-otp', payload);
  },

  async verifyOtp(phone: string, code: string): Promise<PhoneVerificationResult> {
    const payload: OtpVerifyPayload = { phone, code };
    return ApiClient.post<PhoneVerificationResult>('/auth/verify-otp', payload);
  },

  async register(data: RegisterPayload): Promise<RegisterResponse> {
    return ApiClient.post<RegisterResponse>('/auth/register', data);
  },

  async getMe(): Promise<MeResponse> {
    return ApiClient.get<MeResponse>('/auth/me');
  },

  async uploadProfileImage(uri: string): Promise<ProfileImageResponse> {
    const type = uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return ApiClient.uploadFiles<ProfileImageResponse>('/auth/rider/profile/image', [
      { fieldname: 'image', uri, type, name: 'profile.jpg' },
    ], 'PATCH');
  },

  async uploadIdentityDocuments(
    frontUri: string,
    backUri: string
  ): Promise<IdentityUploadResponse> {
    const frontType = frontUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const backType = backUri.endsWith('.png') ? 'image/png' : 'image/jpeg';

    return ApiClient.uploadFiles<IdentityUploadResponse>('/auth/rider/documents/identity', [
      { fieldname: 'identityFront', uri: frontUri, type: frontType, name: 'front.jpg' },
      { fieldname: 'identityBack', uri: backUri, type: backType, name: 'back.jpg' },
    ]);
  },

  async getOnboardingStatus(): Promise<OnboardingStatusResponse> {
    const raw = await ApiClient.get<{ success?: boolean; data?: OnboardingStatusResponse } & OnboardingStatusResponse>('/auth/driver/onboarding-status');
    return raw.data ?? raw;
  }
};
