export interface DecodedOtpToken {
  phone_number: string;
  uid: string;
  [key: string]: unknown;
}

export interface OtpProvider {
  requestOtp(phone: string, traceId: string): Promise<void>;
  verifyCode(phone: string, code: string, traceId: string): Promise<DecodedOtpToken>;
  isInitialized(): boolean;
  getName(): string;
}

export const CONSOLE_SIMULATED_PHONE = "+1234567890";
export const CONSOLE_SIMULATED_UID = "console-simulated-uid";
