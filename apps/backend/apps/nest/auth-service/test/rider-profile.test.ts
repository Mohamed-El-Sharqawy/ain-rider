import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createTestMinio, ensureTestBucket } from "@ain-rider/test-utils";
import type { Client } from "minio";
import { createTestApp } from "./helpers/app";
import { resetAuthDb, setupAuthDb } from "./helpers/db";
import { injectForm, jpegBlob } from "./helpers/http";
import { registerUser } from "./helpers/users";

function listObjectNames(client: Client, bucket: string, prefix: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const names: string[] = [];
    const stream = client.listObjects(bucket, prefix, true);
    stream.on("data", (obj) => names.push(obj.name));
    stream.on("error", reject);
    stream.on("end", () => resolve(names));
  });
}

describe("rider profile uploads", () => {
  let app: NestFastifyApplication;
  let minio: Client;
  let bucket: string;

  beforeAll(async () => {
    await setupAuthDb();
    await resetAuthDb();
    app = await createTestApp();
    minio = createTestMinio();
    bucket = await ensureTestBucket(minio);
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects non-riders", async () => {
    const driver = await registerUser(app, "DRIVER");
    const form = new FormData();
    form.append("image", jpegBlob(), "me.jpg");
    const res = await injectForm(app, "PATCH", "/auth/rider/profile/image", form, {
      authorization: `Bearer ${driver.accessToken}`,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns a validation error payload when no image is attached", async () => {
    const rider = await registerUser(app, "RIDER");
    const form = new FormData();
    form.append("notAFile", "oops");
    const res = await injectForm(app, "PATCH", "/auth/rider/profile/image", form, {
      authorization: `Bearer ${rider.accessToken}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Image file is required" },
    });
  });

  it("stores the profile image and replaces the previous one on re-upload", async () => {
    const rider = await registerUser(app, "RIDER");
    const prefix = `riders/${rider.id}/profile/`;

    const first = await injectForm(app, "PATCH", "/auth/rider/profile/image", (() => {
      const form = new FormData();
      form.append("image", jpegBlob(), "first.jpg");
      return form;
    })(), { authorization: `Bearer ${rider.accessToken}` });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.profileImage.url).toContain(prefix);

    const namesAfterFirst = await listObjectNames(minio, bucket, prefix);
    expect(namesAfterFirst).toHaveLength(1);

    const second = await injectForm(app, "PATCH", "/auth/rider/profile/image", (() => {
      const form = new FormData();
      form.append("image", jpegBlob(), "second.jpg");
      return form;
    })(), { authorization: `Bearer ${rider.accessToken}` });
    expect(second.statusCode).toBe(200);

    // The replaced image must be deleted: exactly one object remains.
    const namesAfterSecond = await listObjectNames(minio, bucket, prefix);
    expect(namesAfterSecond).toHaveLength(1);
    expect(namesAfterSecond[0]).not.toBe(namesAfterFirst[0]);
  });

  it("rejects identity uploads missing one of the two images", async () => {
    const rider = await registerUser(app, "RIDER");
    const form = new FormData();
    form.append("identityFront", jpegBlob(), "front.jpg");
    const res = await injectForm(app, "POST", "/auth/rider/documents/identity", form, {
      authorization: `Bearer ${rider.accessToken}`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe(
      "Both identityFront and identityBack files are required",
    );
  });

  it("stores both identity documents and presigns them", async () => {
    const rider = await registerUser(app, "RIDER");
    const form = new FormData();
    form.append("identityFront", jpegBlob(), "front.jpg");
    form.append("identityBack", jpegBlob(), "back.jpg");

    const res = await injectForm(app, "POST", "/auth/rider/documents/identity", form, {
      authorization: `Bearer ${rider.accessToken}`,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.identityFront.url).toContain("/identity/front.jpg");
    expect(res.json().data.identityBack.url).toContain("/identity/back.jpg");

    const objects = await listObjectNames(minio, bucket, `riders/${rider.id}/identity/`);
    expect(objects).toHaveLength(2);
  });
});
