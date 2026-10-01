import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalServerErrorException } from "@nestjs/common";

const { instances, FakeStorageClient } = vi.hoisted(() => {
  const instances: any[] = [];
  class FakeStorageClient {
    initialize = vi.fn().mockResolvedValue(undefined);
    upload = vi.fn();
    uploadMultiple = vi.fn();
    getPresignedGetUrl = vi.fn();
    getPresignedUrlsForObjectKeys = vi.fn();
    getPresignedPutUrl = vi.fn();
    delete = vi.fn();
    deleteMany = vi.fn();
    listObjects = vi.fn();
    exists = vi.fn();
    ping = vi.fn();
  }
  return { instances, FakeStorageClient };
});

vi.mock("@ain-rider/minio-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ain-rider/minio-client")>();
  return {
    ...actual,
    StorageClient: class {
      constructor(...args: any[]) {
        instances.push(new FakeStorageClient());
        void args;
        return instances[instances.length - 1] as any;
      }
    } as any,
  };
});

import { StorageService } from "../src/shared/storage/storage.service";

describe("StorageService", () => {
  let service: StorageService;
  let client: FakeStorageClient;

  beforeEach(() => {
    instances.length = 0;
    service = new StorageService();
    client = instances[0];
  });

  it("initializes the client on module init", async () => {
    await service.onModuleInit();
    expect(client.initialize).toHaveBeenCalled();
  });

  it("wraps upload failures", async () => {
    client.upload.mockRejectedValue(new Error("bucket gone"));
    await expect(service.upload("obj", Buffer.alloc(1), 1)).rejects.toThrow(
      new InternalServerErrorException("File upload failed"),
    );
    client.upload.mockResolvedValueOnce({ objectName: "obj" });
    await expect(service.upload("obj", Buffer.alloc(1), 1)).resolves.toEqual({
      objectName: "obj",
    });
  });

  it("wraps uploadMultiple failures", async () => {
    client.uploadMultiple.mockRejectedValue(new Error("nope"));
    await expect(service.uploadMultiple([{ objectName: "a", data: Buffer.alloc(1) }])).rejects.toThrow(
      new InternalServerErrorException("Multiple file upload failed"),
    );
    client.uploadMultiple.mockResolvedValueOnce([]);
    await expect(service.uploadMultiple([{ objectName: "a", data: Buffer.alloc(1) }])).resolves.toEqual([]);
  });

  it("wraps getPresignedGetUrl failures", async () => {
    client.getPresignedGetUrl.mockRejectedValue(new Error("sig fail"));
    await expect(service.getPresignedGetUrl("obj", 60)).rejects.toThrow(
      new InternalServerErrorException("Failed to generate presigned URL"),
    );
    client.getPresignedGetUrl.mockResolvedValueOnce({ url: "https://x", expiresAt: new Date() });
    await expect(service.getPresignedGetUrl("obj", 60)).resolves.toBeTruthy();
  });

  it("wraps getPresignedUrlsForObjectKeys failures", async () => {
    client.getPresignedUrlsForObjectKeys.mockRejectedValue(new Error("sig fail"));
    await expect(service.getPresignedUrlsForObjectKeys(["a", "b"])).rejects.toThrow(
      new InternalServerErrorException("Failed to generate presigned URLs"),
    );
    client.getPresignedUrlsForObjectKeys.mockResolvedValueOnce([{ url: "u", expiresAt: new Date() }]);
    await expect(service.getPresignedUrlsForObjectKeys(["a"])).resolves.toHaveLength(1);
  });

  it("wraps getPresignedPutUrl failures", async () => {
    client.getPresignedPutUrl.mockRejectedValue(new Error("sig fail"));
    await expect(service.getPresignedPutUrl("obj")).rejects.toThrow(
      new InternalServerErrorException("Failed to generate presigned upload URL"),
    );
    client.getPresignedPutUrl.mockResolvedValueOnce({ url: "u", expiresAt: new Date() });
    await expect(service.getPresignedPutUrl("obj")).resolves.toBeTruthy();
  });

  it("wraps delete and deleteMany failures", async () => {
    client.delete.mockRejectedValue(new Error("boom"));
    await expect(service.delete("obj")).rejects.toThrow(
      new InternalServerErrorException("File deletion failed"),
    );

    client.deleteMany.mockRejectedValue(new Error("boom"));
    await expect(service.deleteMany(["a", "b"])).rejects.toThrow(
      new InternalServerErrorException("Batch file deletion failed"),
    );

    client.delete.mockResolvedValueOnce(undefined);
    client.deleteMany.mockResolvedValueOnce(undefined);
    await expect(service.delete("obj")).resolves.toBeUndefined();
    await expect(service.deleteMany(["a"])).resolves.toBeUndefined();
  });

  it("wraps listObjects failures and passes list results through", async () => {
    client.listObjects.mockRejectedValue(new Error("boom"));
    await expect(service.listObjects("prefix/")).rejects.toThrow(
      new InternalServerErrorException("Failed to list objects"),
    );

    client.listObjects.mockResolvedValueOnce([
      { objectName: "prefix/a", size: 1, lastModified: new Date(), etag: "e" },
    ]);
    await expect(service.listObjects("prefix/")).resolves.toHaveLength(1);
  });

  it("passes exists and ping through unwrapped", async () => {
    client.exists.mockResolvedValue(true);
    client.ping.mockResolvedValue(false);

    await expect(service.exists("obj")).resolves.toBe(true);
    await expect(service.ping()).resolves.toBe(false);
  });
});
