import type { OtpProvider, DecodedOtpToken } from "./otp-provider.interface";
import { CONSOLE_SIMULATED_UID } from "./otp-provider.interface";

/**
 * Console-based OTP Provider for development and testing.
 */
export class ConsoleProvider implements OtpProvider {
  private initialized: boolean = true;

  async requestOtp(phone: string, traceId: string): Promise<void> {
    console.log(
      `[ConsoleProvider] SMS Request Sim: Sending OTP code '123456' to ${phone} | traceId=${traceId}`,
    );
  }

  async verifyCode(
    phone: string,
    code: string,
    traceId: string,
  ): Promise<DecodedOtpToken> {
    console.log(
      `[ConsoleProvider] Simulating code verification | phone=${phone} | code=${code} | traceId=${traceId}`,
    );

    if (code !== "123456") {
      throw new Error("Invalid or expired OTP code");
    }

    return {
      phone_number: phone,
      uid: CONSOLE_SIMULATED_UID,
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getName(): string {
    return "console";
  }
}
