import * as admin from "firebase-admin";
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n",
      );

      if (!projectId || !clientEmail || !privateKey) {
        console.warn(
          "[FirebaseService] Firebase credentials missing from environment variables. OTP verification will fail.",
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
      console.log("[FirebaseService] Firebase Admin initialized.");
    }
  }

  /**
   * Verifies a Firebase Phone Auth ID token and returns the decoded token.
   *
   * @param idToken - The Firebase ID token from client-side Phone Auth
   * @returns The decoded Firebase token containing uid, phone_number, and other claims
   * @throws UnauthorizedException if Firebase Admin is not configured
   * @throws UnauthorizedException if the token is invalid or expired
   *
   * @example
   * const decoded = await this.verifyIdToken(idToken);
   * const phoneNumber = decoded.phone_number; // E.164 format
   * const uid = decoded.uid;
   */
  async verifyIdToken(idToken: string) {
    if (!admin.apps.length) {
      throw new UnauthorizedException(
        "Firebase Admin is not configured on the server",
      );
    }
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("[FirebaseService] Token verification failed:", error);
      throw new UnauthorizedException("Invalid or expired Firebase ID token");
    }
  }
}
