import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestApp } from "./helpers/app";
import { resetAuthDb, setupAuthDb } from "./helpers/db";
import { injectForm, jpegBlob, uniqueEmail, uniquePhone } from "./helpers/http";
import { registerUser } from "./helpers/users";

const INTERNAL_SECRET = "test-internal-secret";

function vehicleFields(overrides: Record<string, string> = {}) {
  return {
    make: "Toyota",
    model: "Corolla",
    year: "2022",
    color: "white",
    plateNumber: `ABC-${Math.floor(1000 + Math.random() * 8999)}`,
    ...overrides,
  };
}

async function injectVehicle(
  app: NestFastifyApplication,
  token: string,
  fields: Record<string, string>,
  withImages = true,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  if (withImages) {
    form.append("carImage", jpegBlob(), "car.jpg");
    form.append("carLicenseImage", jpegBlob(), "car-license.jpg");
  }
  return injectForm(app, "POST", "/auth/driver/vehicle", form, {
    authorization: `Bearer ${token}`,
  });
}

describe("driver onboarding flow", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await setupAuthDb();
    await resetAuthDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  let driver: Awaited<ReturnType<typeof registerUser>>;

  beforeAll(async () => {
    driver = await registerUser(app, "DRIVER");
  });

  it("rejects unauthenticated and non-driver access", async () => {
    const noAuth = await app.inject({
      method: "PATCH",
      url: "/auth/driver/profile",
      payload: { city: "Cairo" },
    });
    expect(noAuth.statusCode).toBe(401);

    const rider = await registerUser(app, "RIDER");
    const notDriver = await app.inject({
      method: "PATCH",
      url: "/auth/driver/profile",
      headers: { authorization: `Bearer ${rider.accessToken}` },
      payload: { city: "Cairo" },
    });
    expect(notDriver.statusCode).toBe(403);
  });

  it("updates the driver profile fields", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/auth/driver/profile",
      headers: { authorization: `Bearer ${driver.accessToken}` },
      payload: {
        address: "1 Tahrir Sq",
        city: "Cairo",
        state: "Cairo",
        country: "Egypt",
        dateOfBirth: "1995-05-01",
        emergencyContactName: "Mum",
        emergencyContactPhone: "+201000000001",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.user).toMatchObject({ city: "Cairo", country: "Egypt" });
    expect(res.json().data.onboardingStatus).toBe("PENDING_DOCUMENTS");
  });

  it("blocks going online until approved, then allows it", async () => {
    const blocked = await app.inject({
      method: "PATCH",
      url: "/auth/driver/status",
      headers: { authorization: `Bearer ${driver.accessToken}` },
      payload: { isOnline: true },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error.message).toContain("Only approved drivers can go online");

    // Going offline is always allowed.
    const offline = await app.inject({
      method: "PATCH",
      url: "/auth/driver/status",
      headers: { authorization: `Bearer ${driver.accessToken}` },
      payload: { isOnline: false },
    });
    expect(offline.statusCode).toBe(200);
    expect(offline.json().data.isOnline).toBe(false);
  });

  it("rejects identity uploads that are not exactly 3 images", async () => {
    const form = new FormData();
    form.append("front", jpegBlob(), "f1.jpg");
    form.append("back", jpegBlob(), "f2.jpg");
    const res = await injectForm(app, "POST", "/auth/driver/documents/identity", form, {
      authorization: `Bearer ${driver.accessToken}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects identity uploads with a disallowed mimetype", async () => {
    const form = new FormData();
    for (let i = 0; i < 3; i += 1) {
      form.append(`doc${i}`, new Blob([Buffer.alloc(4)], { type: "application/pdf" }), `d${i}.pdf`);
    }
    const res = await injectForm(app, "POST", "/auth/driver/documents/identity", form, {
      authorization: `Bearer ${driver.accessToken}`,
    });
    expect(res.statusCode).toBe(415);
  });

  it("uploads 3 identity images and tracks the attempt count", async () => {
    const form = new FormData();
    for (let i = 0; i < 3; i += 1) {
      form.append(`doc${i}`, jpegBlob(), `id-${i}.jpg`);
    }
    const res = await injectForm(app, "POST", "/auth/driver/documents/identity", form, {
      authorization: `Bearer ${driver.accessToken}`,
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.identityImages).toHaveLength(3);
    expect(data.status).toBe("PENDING");
    expect(data.uploadAttempts).toBe(1);
    expect(data.onboardingStatus).toBe("PENDING_DOCUMENTS");
  });

  it("rejects license uploads without 2 images or a license number", async () => {
    const noImages = new FormData();
    noImages.append("licenseNumber", "LIC-123");
    noImages.append("front", jpegBlob(), "l1.jpg");
    const missing = await injectForm(
      app,
      "POST",
      "/auth/driver/documents/driving-license",
      noImages,
      { authorization: `Bearer ${driver.accessToken}` },
    );
    expect(missing.statusCode).toBe(400);

    const twoImages = new FormData();
    twoImages.append("front", jpegBlob(), "l1.jpg");
    twoImages.append("back", jpegBlob(), "l2.jpg");
    const noNumber = await injectForm(
      app,
      "POST",
      "/auth/driver/documents/driving-license",
      twoImages,
      { authorization: `Bearer ${driver.accessToken}` },
    );
    expect(noNumber.statusCode).toBe(400);
    expect(noNumber.json().error.message).toBe("License number is required");
  });

  it("uploads the driving license and claims the license number", async () => {
    const form = new FormData();
    form.append("licenseNumber", "EGY-2026-0001");
    form.append("front", jpegBlob(), "l1.jpg");
    form.append("back", jpegBlob(), "l2.jpg");

    const res = await injectForm(app, "POST", "/auth/driver/documents/driving-license", form, {
      authorization: `Bearer ${driver.accessToken}`,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.drivingLicenseImages).toHaveLength(2);
    expect(res.json().data.uploadAttempts).toBe(1);
  });

  it("rejects duplicate license numbers from other drivers", async () => {
    const other = await registerUser(app, "DRIVER");
    const form = new FormData();
    form.append("licenseNumber", "EGY-2026-0001");
    form.append("front", jpegBlob(), "l1.jpg");
    form.append("back", jpegBlob(), "l2.jpg");

    const res = await injectForm(app, "POST", "/auth/driver/documents/driving-license", form, {
      authorization: `Bearer ${other.accessToken}`,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain("already registered to another driver");
  });

  it("rejects vehicles with invalid plates or years", async () => {
    const badPlate = await injectVehicle(app, driver.accessToken, vehicleFields({ plateNumber: "nope!" }));
    expect(badPlate.statusCode).toBe(400);

    const badYear = await injectVehicle(
      app,
      driver.accessToken,
      vehicleFields({ year: String(new Date().getFullYear() + 5) }),
    );
    expect(badYear.statusCode).toBe(400);
  });

  it("requires both vehicle images", async () => {
    const res = await injectVehicle(app, driver.accessToken, vehicleFields(), false);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe("Both carImage and carLicenseImage are required");
  });

  it("registers the vehicle and transitions to UNDER_REVIEW", async () => {
    const res = await injectVehicle(app, driver.accessToken, vehicleFields());
    expect(res.statusCode).toBe(201);
    const data = res.json().data;
    expect(data.status).toBe("PENDING");
    expect(data.carImage.url).toContain(`/drivers/${driver.id}/vehicle/`);
    expect(data.onboardingStatus).toBe("UNDER_REVIEW");

    const status = await app.inject({
      method: "GET",
      url: "/auth/driver/onboarding-status",
      headers: { authorization: `Bearer ${driver.accessToken}` },
    });
    expect(status.statusCode).toBe(200);
    const documents = status.json().data.documents;
    expect(documents.identity.images).toHaveLength(3);
    expect(documents.drivingLicense.images).toHaveLength(2);
    expect(documents.vehicle.details).toMatchObject({ make: "Toyota", model: "Corolla" });
    expect(status.json().data.onboardingStatus).toBe("UNDER_REVIEW");
  });

  it("caps document uploads after three attempts", async () => {
    const capped = await registerUser(app, "DRIVER");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const form = new FormData();
      for (let i = 0; i < 3; i += 1) {
        form.append(`doc${i}`, jpegBlob(), `id-${attempt}-${i}.jpg`);
      }
      const res = await injectForm(app, "POST", "/auth/driver/documents/identity", form, {
        authorization: `Bearer ${capped.accessToken}`,
      });
      expect(res.statusCode).toBe(201);
    }

    const form = new FormData();
    for (let i = 0; i < 3; i += 1) {
      form.append(`doc${i}`, jpegBlob(), `id-4-${i}.jpg`);
    }
    const rejected = await injectForm(app, "POST", "/auth/driver/documents/identity", form, {
      authorization: `Bearer ${capped.accessToken}`,
    });
    expect(rejected.statusCode).toBe(429);
    expect(rejected.json().error.message).toContain("Maximum upload attempts reached");
  });

  describe("admin routes", () => {
    it("exposes onboarding status for admin tooling but requires the internal secret", async () => {
      const unguarded = await app.inject({
        method: "GET",
        url: `/auth/driver/${driver.id}/onboarding-status`,
      });
      expect(unguarded.statusCode).toBe(401);

      const guarded = await app.inject({
        method: "GET",
        url: `/auth/driver/${driver.id}/onboarding-status`,
        headers: { "x-internal-secret": INTERNAL_SECRET },
      });
      expect(guarded.statusCode).toBe(200);
      expect(guarded.json().data.onboardingStatus).toBe("UNDER_REVIEW");

      const unknown = await app.inject({
        method: "GET",
        url: `/auth/driver/00000000-0000-4000-8000-000000000000/onboarding-status`,
        headers: { "x-internal-secret": INTERNAL_SECRET },
      });
      expect(unknown.statusCode).toBe(404);
    });

    it("resets upload attempts on internal command", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/auth/driver/${driver.id}/reset-attempts`,
        headers: { "x-internal-secret": INTERNAL_SECRET },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        success: true,
        message: "Upload attempts reset successfully",
      });

      const denied = await app.inject({
        method: "PATCH",
        url: `/auth/driver/${driver.id}/reset-attempts`,
      });
      expect(denied.statusCode).toBe(401);
    });
  });
});
