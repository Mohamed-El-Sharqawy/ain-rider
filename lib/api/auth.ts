import { ApiClient } from './client';
import { OtpRequestPayload } from './types';

export const AuthApi = {
  async requestOtp(phone: string): Promise<void> {
    const payload: OtpRequestPayload = { phone };
    await ApiClient.post('/auth/request-otp', payload);
  },
};
