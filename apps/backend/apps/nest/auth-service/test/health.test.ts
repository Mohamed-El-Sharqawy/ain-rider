import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestApp } from "./helpers/app";
import { resetAuthDb, setupAuthDb } from "./helpers/db";

describe("health endpoints", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await setupAuthDb();
    await resetAuthDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports ready", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready", service: "auth-service" });
  });

  it("passes the prisma health check", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });
});
