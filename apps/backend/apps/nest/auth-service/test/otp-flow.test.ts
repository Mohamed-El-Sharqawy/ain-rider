import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { CONSOLE_SIMULATED_UID } from "../src/auth/otp-providers/otp-provider.interface";
import { createTestApp } from "./helpers/app";
import { resetAuthDb, setupAuthDb } from "./helpers/db";
import { uniqueEmail, uniquePhone } from "./helpers/http";
import { subscribeNewEvents } from "./helpers/nats-events";
import { registerUser } from "./helpers/users";

const OTP_CODE = "123456";

describe("POST /auth/request-otp", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await setupAuthDb();
    await resetAuthDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts a valid Egyptian mobile number", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/request-otp",
      payload: { phone: uniquePhone() },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ success: true });
  });

  it("rejects non-Egyptian phone formats with 400", async () => {
    for (const phone of ["201001234567", "+20100234567", "+201999999999", "not-a-phone"]) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/request-otp",
        payload: { phone },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects a missing phone with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/request-otp",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/verify-otp (console provider test code path)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await setupAuthDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("verifies the console test code for an unregistered phone and flags registration", async () => {
    const phone = uniquePhone();
    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone, code: OTP_CODE },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      success: true,
      isRegistered: false,
      phoneNumber: phone,
      uid: CONSOLE_SIMULATED_UID,
    });
    expect(body.accessToken).toBeUndefined();
  });

  it("verifies a registered user and issues a session", async () => {
    const phone = uniquePhone();
    await registerUser(app, "RIDER", phone);

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone, code: OTP_CODE },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.isRegistered).toBe(true);
    expect(body.user.phoneNumber).toBe(phone);
    expect(body.user.passwordHash).toBeUndefined();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("rejects a wrong code with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone: uniquePhone(), code: "654321" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed code (not 6 digits) with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone: uniquePhone(), code: "12345" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a bad phone format with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone: "+33123456789", code: OTP_CODE },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-whitelisted extra fields with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone: uniquePhone(), code: OTP_CODE, isAdmin: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it("publishes otp_verified on JetStream after a successful verification", async () => {
    const phone = uniquePhone();
    const verifier = await subscribeNewEvents("ain_rider.otp.verified", "otp-flow-test");

    // Prime the provider (no-op for console) to mirror the mobile flow.
    await app.inject({
      method: "POST",
      url: "/auth/request-otp",
      payload: { phone },
    });

    const verifyPromise = app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: { phone, code: OTP_CODE },
    });

    const event = await verifier.next();
    expect(event).toMatchObject({
      eventType: "otp_verified",
      data: { phoneNumber: phone, uid: CONSOLE_SIMULATED_UID },
    });
    expect(typeof event.data.verifiedAt).toBe("string");
    expect(event.traceId).toEqual(expect.any(String));

    const res = await verifyPromise;
    expect(res.statusCode).toBe(201);
  });
});
