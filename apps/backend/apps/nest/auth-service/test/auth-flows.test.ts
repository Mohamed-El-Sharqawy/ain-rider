import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JwtService } from "@nestjs/jwt";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { UserRole } from "@ain-rider/shared-types";
import { createTestApp } from "./helpers/app";
import { resetAuthDb, setupAuthDb } from "./helpers/db";
import { uniqueEmail, uniquePhone } from "./helpers/http";
import { registerUser } from "./helpers/users";

describe("auth flows (register / login / refresh / me / admin)", () => {
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

  let riderEmail: string;
  let riderPassword = "S3cure-pass!";

  it("registers a rider and returns sanitized user with tokens", async () => {
    riderEmail = uniqueEmail("rider");
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: riderEmail,
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "Ride",
        lastName: "One",
        role: "RIDER",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe(riderEmail);
    expect(body.user.passwordHash).toBeUndefined();
    expect(typeof body.accessToken).toBe("string");
    expect(typeof body.refreshToken).toBe("string");
  });

  it("rejects duplicate email with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: riderEmail,
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "Dup",
        lastName: "Email",
        role: "RIDER",
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toBe("Email already registered");
  });

  it("rejects duplicate phone with 409", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: uniqueEmail("phone-a"),
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "Phone",
        lastName: "A",
        role: "RIDER",
      },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: uniqueEmail("phone-b"),
        phoneNumber: first.json().user.phoneNumber,
        password: riderPassword,
        firstName: "Phone",
        lastName: "B",
        role: "RIDER",
      },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.message).toBe("Phone number already registered");
  });

  it("rejects public registration with the ADMIN role", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: uniqueEmail("admin"),
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "No",
        lastName: "Admin",
        role: "ADMIN",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("logs in with valid credentials and fails with bad ones", async () => {
    const badPassword = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: riderEmail, password: "wrong-password" },
    });
    expect(badPassword.statusCode).toBe(401);

    const unknownEmail = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: uniqueEmail("ghost"), password: riderPassword },
    });
    expect(unknownEmail.statusCode).toBe(401);

    const ok = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: riderEmail, password: riderPassword },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().user.email).toBe(riderEmail);
    expect(ok.json().refreshToken).toBeTruthy();
  });

  it("rotates refresh tokens and detects reuse by revoking the family", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: riderEmail, password: riderPassword },
    });
    const { refreshToken } = login.json();

    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(refreshed.statusCode).toBe(201);
    const newTokens = refreshed.json();
    expect(newTokens.refreshToken).toBeTruthy();
    expect(newTokens.refreshToken).not.toBe(refreshToken);

    // Reuse of the rotated-away token revokes the whole family.
    const reuse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(reuse.statusCode).toBe(401);

    // The replacement token from the now-revoked family is dead too.
    const familyKilled = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { authorization: `Bearer ${newTokens.refreshToken}` },
    });
    expect(familyKilled.statusCode).toBe(401);
  });

  it("rejects refresh requests without, with garbage, or with non-refresh tokens", async () => {
    const noHeader = await app.inject({ method: "POST", url: "/auth/refresh" });
    expect(noHeader.statusCode).toBe(401);

    const garbage = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { authorization: "Bearer not.a.jwt" },
    });
    expect(garbage.statusCode).toBe(401);

    const rider = await registerUser(app, "RIDER");
    const accessToken = await jwt.sign(
      { sub: rider.id, email: rider.email, role: "RIDER", type: "access" },
      { expiresIn: "15m" },
    );
    const wrongType = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(wrongType.statusCode).toBe(401);
  });

  it("returns the current user on /auth/me and 401s without a token", async () => {
    const noToken = await app.inject({ method: "GET", url: "/auth/me" });
    expect(noToken.statusCode).toBe(401);

    const rider = await registerUser(app, "RIDER");
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${rider.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.email).toBe(rider.email);
    expect(body.passwordHash).toBeUndefined();
    expect(body.images).toEqual({});
  });

  it("presigns profile and rider identity images on /auth/me", async () => {
    const rider = await registerUser(app, "RIDER");
    await prisma.user.update({
      where: { id: rider.id },
      data: { profileImage: `riders/${rider.id}/profile/fake.jpg` },
    });
    await prisma.rider.update({
      where: { userId: rider.id },
      data: {
        identityFront: `riders/${rider.id}/identity/front.jpg`,
        identityBack: `riders/${rider.id}/identity/back.jpg`,
      },
    });

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${rider.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    const images = me.json().images;
    expect(images.profileImage.url).toContain(`riders/${rider.id}/profile/fake.jpg`);
    expect(images.identityFront.url).toContain("/identity/front.jpg");
    expect(images.identityBack.url).toContain("/identity/back.jpg");
  });

  it("lets only admins create users via /auth/admin/create-user", async () => {
    const rider = await registerUser(app, "RIDER");
    const forbidden = await app.inject({
      method: "POST",
      url: "/auth/admin/create-user",
      headers: { authorization: `Bearer ${rider.accessToken}` },
      payload: {
        email: uniqueEmail("nope"),
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "Not",
        lastName: "Admin",
        role: "SUPPORT",
      },
    });
    expect(forbidden.statusCode).toBe(403);

    // Seed an admin directly (public registration forbids the role).
    const adminUser = await authService.adminCreateUser(
      {
        email: uniqueEmail("admin"),
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "Real",
        lastName: "Admin",
        role: UserRole.ADMIN,
      },
      "system",
    );
    const adminToken = await jwt.sign(
      { sub: adminUser.user.id, email: adminUser.user.email, role: UserRole.ADMIN, type: "access" },
      { expiresIn: "15m" },
    );

    const ok = await app.inject({
      method: "POST",
      url: "/auth/admin/create-user",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: uniqueEmail("support"),
        phoneNumber: uniquePhone(),
        password: riderPassword,
        firstName: "New",
        lastName: "Support",
        role: "SUPPORT",
      },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().user.role).toBe("SUPPORT");
    expect(ok.json().createdBy).toBe(adminUser.user.id);
  });
});
