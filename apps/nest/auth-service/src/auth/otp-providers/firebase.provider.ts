import * as admin from "firebase-admin";
import { OtpProvider, DecodedOtpToken } from "./otp-provider.interface";

export class FirebaseProvider implements OtpProvider {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "[FirebaseProvider] Firebase credentials missing. OTP verification will fail.",
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    this.initialized = true;
    console.log("[FirebaseProvider] Firebase Admin initialized.");
  }

  async requestOtp(phone: string, traceId: string): Promise<void> {
    console.warn(
      `[FirebaseProvider] requestOtp is NOT natively supported via Firebase Admin. | phone=${phone} | traceId=${traceId}`,
    );
    throw new Error(
      "Firebase Admin does not support requesting SMS codes. Use client SDK or ConsoleProvider.",
    );
  }

  async verifyCode(
    phone: string,
    // code: string,
    traceId: string,
  ): Promise<DecodedOtpToken> {
    console.warn(
      `[FirebaseProvider] verifyCode is NOT natively supported via Firebase Admin. | phone=${phone} | traceId=${traceId}`,
    );
    throw new Error(
      "Firebase Admin does not support verifying plain codes. It requires a client-side ID Token.",
    );
  }

  getName(): string {
    return "firebase";
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
