import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

const { adminApps, verifyIdToken } = vi.hoisted(() => ({
  adminApps: [] as any[],
  verifyIdToken: vi.fn(),
}));

vi.mock("firebase-admin", () => ({
  apps: adminApps,
  initializeApp: vi.fn(),
  credential: { cert: vi.fn(() => "mock-cert") },
  auth: () => ({ verifyIdToken }),
}));

import * as admin from "firebase-admin";
import { FirebaseService } from "../src/auth/firebase.service";

beforeEach(() => {
  adminApps.length = 0;
  verifyIdToken.mockReset();
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;
});

describe("FirebaseService", () => {
  it("warns and skips initialization without credentials", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = new FirebaseService();

    service.onModuleInit();

    expect(admin.initializeApp).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("credentials missing"));
  });

  it("skips initialization when an admin app already exists", () => {
    adminApps.push({ name: "existing" });
    const service = new FirebaseService();

    service.onModuleInit();

    expect(admin.initializeApp).not.toHaveBeenCalled();
  });

  it("initializes the admin app from environment credentials", () => {
    process.env.FIREBASE_PROJECT_ID = "proj";
    process.env.FIREBASE_CLIENT_EMAIL = "svc@proj";
    process.env.FIREBASE_PRIVATE_KEY = "key\\nwith\\nnewlines";
    vi.spyOn(console, "log").mockImplementation(() => {});
    const service = new FirebaseService();

    service.onModuleInit();

    expect(admin.credential.cert).toHaveBeenCalledWith({
      projectId: "proj",
      clientEmail: "svc@proj",
      privateKey: "key\nwith\nnewlines",
    });
  });

  it("refuses to verify tokens when not configured", async () => {
    const service = new FirebaseService();

    await expect(service.verifyIdToken("token")).rejects.toThrow(
      new UnauthorizedException("Firebase Admin is not configured on the server"),
    );
  });

  it("returns the decoded token and wraps verification failures", async () => {
    adminApps.push({ name: "app" });
    const service = new FirebaseService();
    const decoded = { uid: "u1", phone_number: "+201000000000" };

    verifyIdToken.mockResolvedValueOnce(decoded);
    await expect(service.verifyIdToken("good")).resolves.toBe(decoded);

    verifyIdToken.mockRejectedValueOnce(new Error("token expired"));
    await expect(service.verifyIdToken("bad")).rejects.toThrow(
      new UnauthorizedException("Invalid or expired Firebase ID token"),
    );
  });
});
