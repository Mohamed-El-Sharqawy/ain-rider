import { ApiClient } from './client';
import { OtpRequestPayload, OtpVerifyPayload, PhoneVerificationResult, RegisterPayload, RegisterResponse } from './types';

export const AuthApi = {
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
  }
};
