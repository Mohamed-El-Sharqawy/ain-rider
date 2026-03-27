import * as admin from "firebase-admin";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { OtpProvider, DecodedOtpToken } from "./otp-provider.interface";

@Injectable()
export class FirebaseProvider implements OtpProvider, OnModuleInit {
  private initialized = false;

  onModuleInit() {
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n",
      );

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
    } else {
      this.initialized = true;
    }
  }

  isAvailable(): boolean {
    return admin.apps.length > 0;
  }

  async verify(idToken: string, traceId: string): Promise<DecodedOtpToken> {
    if (!this.isAvailable()) {
      throw new Error("Firebase Admin is not configured on the server");
    }

    console.log(`[FirebaseProvider] Verifying token | traceId=${traceId}`);

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);

      if (!decoded.phone_number) {
        throw new Error("Phone number not present in Firebase token");
      }

      console.log(
        `[FirebaseProvider] Token verified | phone=${decoded.phone_number} | traceId=${traceId}`,
      );

      return {
        phone_number: decoded.phone_number,
        uid: decoded.uid,
      };
    } catch (error) {
      console.error("[FirebaseProvider] Token verification failed:", error);
      throw new Error("Invalid or expired Firebase ID token");
    }
  }

  getName(): string {
    return "firebase";
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
