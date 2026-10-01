import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin", () => ({
  apps: [] as unknown[],
  initializeApp: vi.fn(),
  credential: { cert: vi.fn(() => "mock-cert") },
  auth: vi.fn(() => ({ verifyIdToken: vi.fn() })),
}));

import * as admin from "firebase-admin";
import { ConsoleProvider } from "../src/auth/otp-providers/console.provider";
import { CONSOLE_SIMULATED_UID } from "../src/auth/otp-providers/otp-provider.interface";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("ConsoleProvider", () => {
  it("accepts the default test code 123456 and returns a simulated identity", async () => {
    const provider = new ConsoleProvider();

    await expect(provider.verifyCode("+201000000000", "123456", "t")).resolves.toEqual({
      phone_number: "+201000000000",
      uid: CONSOLE_SIMULATED_UID,
    });
    await expect(provider.verifyCode("+201000000000", "654321", "t")).rejects.toThrow(
      "Invalid or expired OTP code",
    );
  });

  it("honours the TEST_OTP_CODE environment override", async () => {
    vi.stubEnv("TEST_OTP_CODE", "999999");
    const provider = new ConsoleProvider();

    await expect(provider.verifyCode("+201000000000", "999999", "t")).resolves.toBeTruthy();
    await expect(provider.verifyCode("+201000000000", "123456", "t")).rejects.toThrow(
      "Invalid or expired OTP code",
    );
  });

  it("logs simulated SMS delivery on requestOtp", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = new ConsoleProvider();

    await provider.requestOtp("+201000000000", "trace-9");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Sending OTP code"));
  });

  it("reports its identity and initialized state", () => {
    const provider = new ConsoleProvider();
    expect(provider.getName()).toBe("console");
    expect(provider.isInitialized()).toBe(true);
  });
});

describe("FirebaseProvider", () => {
  it("stays uninitialized when Firebase credentials are missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { FirebaseProvider } = await import("../src/auth/otp-providers/firebase.provider");

    const provider = new FirebaseProvider();
    expect(provider.isInitialized()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("credentials missing"));
  });

  it("initializes with credentials and rejects non-supported operations", async () => {
    process.env.FIREBASE_PROJECT_ID = "proj";
    process.env.FIREBASE_CLIENT_EMAIL = "svc@proj.iam";
    process.env.FIREBASE_PRIVATE_KEY = "line1\\nline2";

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { FirebaseProvider } = await import("../src/auth/otp-providers/firebase.provider");
    const provider = new FirebaseProvider();

    expect(admin.credential.cert).toHaveBeenCalledWith({
      projectId: "proj",
      clientEmail: "svc@proj.iam",
      privateKey: "line1\nline2",
    });
    expect(provider.isInitialized()).toBe(true);
    expect(provider.getName()).toBe("firebase");

    await expect(provider.requestOtp("+201000000000", "t")).rejects.toThrow(
      "Firebase Admin does not support requesting SMS codes",
    );
    await expect(provider.verifyCode("+201000000000", "123456", "t")).rejects.toThrow(
      "Firebase Admin does not support verifying plain codes",
    );

    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
  });

  it("reuses an existing admin app without re-initializing", async () => {
    (admin as any).apps = [{ name: "existing" }];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { FirebaseProvider } = await import("../src/auth/otp-providers/firebase.provider");

    const provider = new FirebaseProvider();
    expect(provider.isInitialized()).toBe(true);
    expect(admin.initializeApp).not.toHaveBeenCalled();
    (admin as any).apps = [];
  });
});
