export interface PhoneVerificationResult {
  success: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface OtpRequestPayload {
  phone: string;
}

export interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export interface ApiErrorResponse {
  message: string;
  error?: {
    message: string;
  };
  retryAfterSeconds?: number;
}
