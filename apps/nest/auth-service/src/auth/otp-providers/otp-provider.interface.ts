export interface DecodedOtpToken {
  phone_number: string;
  uid: string;
  [key: string]: unknown;
}

export interface OtpProvider {
  verify(idToken: string, traceId: string): Promise<DecodedOtpToken>;
  isInitialized(): boolean;
  getName(): string;
}

export const OTP_PROVIDER = process.env.OTP_PROVIDER || "firebase";
export const CONSOLE_SIMULATED_PHONE = "+1234567890";
export const CONSOLE_SIMULATED_UID = "console-simulated-uid";
