import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JwtService } from "@nestjs/jwt";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./helpers/app";
import { resetAuthDb, setupAuthDb } from "./helpers/db";
import { uniqueEmail, uniquePhone } from "./helpers/http";
import { registerUser } from "./helpers/users";

const INTERNAL_SECRET = "test-internal-secret";
const internalHeaders = { "x-internal-secret": INTERNAL_SECRET };

describe("internal + admin endpoints", () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let authService: AuthService;

  beforeAll(async () => {
    await setupAuthDb();
    await resetAuthDb();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  let adminToken: string;
  let riderId: string;
  let driverUserId: string;

  beforeAll(async () => {
    const rider = await registerUser(app, "RIDER");
    riderId = rider.id!;

    const driver = await registerUser(app, "DRIVER");
    driverUserId = driver.id!;

    const adminUser = await authService.adminCreateUser(
      {
        email: uniqueEmail("admin"),
        phoneNumber: uniquePhone(),
        password: "S3cure-pass!",
        firstName: "Admin",
        lastName: "User",
        role: "ADMIN",
      },
      "system",
    );
    adminToken = await jwt.sign(
      {
        sub: adminUser.user.id,
        email: adminUser.user.email,
        role: "ADMIN",
        type: "access",
      },
      { expiresIn: "15m" },
    );
  });

  describe("GET /auth/admin/users", () => {
    it("rejects requests without the internal secret", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/admin/users" });
      expect(res.statusCode).toBe(401);
    });

    it("lists users with pagination and filters", async () => {
      const all = await app.inject({
        method: "GET",
        url: "/auth/admin/users",
        headers: internalHeaders,
      });
      expect(all.statusCode).toBe(200);
      expect(all.json().total).toBeGreaterThanOrEqual(2);

      const riders = await app.inject({
        method: "GET",
        url: "/auth/admin/users?role=RIDER&take=10",
        headers: internalHeaders,
      });
      expect(riders.statusCode).toBe(200);
      expect(riders.json().users.length).toBeGreaterThanOrEqual(1);
      expect(riders.json().users[0].passwordHash).toBeUndefined();

      const paginated = await app.inject({
        method: "GET",
        url: "/auth/admin/users?skip=0&take=1&status=ACTIVE",
        headers: internalHeaders,
      });
      expect(paginated.statusCode).toBe(200);
      expect(paginated.json().users.length).toBeLessThanOrEqual(1);

      const search = await app.inject({
        method: "GET",
        url: `/auth/admin/users?search=${encodeURIComponent(riderId)}`,
        headers: internalHeaders,
      });
      expect(search.statusCode).toBe(200);
    });
  });

  describe("GET /auth/admin/users/stats", () => {
    it("aggregates role counts", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/admin/users/stats",
        headers: internalHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        total: expect.any(Number),
        drivers: expect.any(Number),
        riders: expect.any(Number),
      });
    });
  });

  describe("GET /auth/admin/users/:id", () => {
    it("returns the user with relations", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/auth/admin/users/${riderId}`,
        headers: internalHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().rider).toBeTruthy();
    });

    it("404s for unknown ids", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/auth/admin/users/00000000-0000-4000-8000-000000000000`,
        headers: internalHeaders,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /auth/admin/users/:id", () => {
    it("updates profile fields", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/auth/admin/users/${riderId}`,
        headers: internalHeaders,
        payload: { firstName: "Renamed", city: "Cairo" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: riderId, firstName: "Renamed", city: "Cairo" });
    });
  });

  describe("POST /auth/admin/create-user (admin gate)", () => {
    it("rejects non-admin access tokens", async () => {
      const rider = await registerUser(app, "RIDER");
      const res = await app.inject({
        method: "POST",
        url: "/auth/admin/create-user",
        headers: { authorization: `Bearer ${rider.accessToken}` },
        payload: {
          email: uniqueEmail("x"),
          phoneNumber: uniquePhone(),
          password: "S3cure-pass!",
          firstName: "X",
          lastName: "Y",
          role: "RIDER",
        },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe("GET /internal/users/:id/basic", () => {
    it("returns the rider rating for riders", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/internal/users/${riderId}/basic`,
        headers: internalHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id: riderId,
        role: "RIDER",
        rating: expect.any(Number),
      });
    });

    it("returns the driver rating for drivers", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/internal/users/${driverUserId}/basic`,
        headers: internalHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().role).toBe("DRIVER");
      expect(res.json().rating).toBe(5.0);
    });

    it("404s for unknown ids", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/internal/users/00000000-0000-4000-8000-000000000000/basic`,
        headers: internalHeaders,
      });
      expect(res.statusCode).toBe(404);
    });

    it("rejects requests without the internal secret", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/internal/users/${riderId}/basic`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  it("never leaks password hashes through admin updates", async () => {
    const user = await prisma.user.findUnique({ where: { id: riderId } });
    expect(user).toBeTruthy();
    const res = await app.inject({
      method: "GET",
      url: `/auth/admin/users/${riderId}`,
      headers: { "x-internal-secret": INTERNAL_SECRET, authorization: `Bearer ${adminToken}` },
    });
    expect(res.json().passwordHash).toBeUndefined();
  });
});
