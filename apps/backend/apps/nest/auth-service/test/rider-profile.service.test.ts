import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { RiderProfileService } from "../src/rider-profile/rider-profile.service";

function makeDeps() {
  return {
    prisma: {
      rider: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue({}),
      },
    },
    storage: {
      upload: vi.fn().mockResolvedValue({ objectName: "obj" }),
      uploadMultiple: vi.fn().mockResolvedValue([]),
      getPresignedGetUrl: vi
        .fn()
        .mockResolvedValue({ url: "https://signed", expiresAt: new Date() }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    buffer: Buffer.alloc(10),
    originalname: "f.jpg",
    mimetype: "image/jpeg",
    size: 10,
    ...overrides,
  };
}

describe("RiderProfileService.uploadProfileImage", () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: RiderProfileService;

  beforeEach(() => {
    deps = makeDeps();
    service = new RiderProfileService(deps.prisma as any, deps.storage as any);
  });

  it("rejects disallowed mimetypes", async () => {
    await expect(
      service.uploadProfileImage("user-1", file({ mimetype: "image/gif" })),
    ).rejects.toThrow(UnsupportedMediaTypeException);
  });

  it("rejects files above 10MB", async () => {
    await expect(
      service.uploadProfileImage("user-1", file({ size: 11 * 1024 * 1024 })),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it("404s for unknown riders", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce(null);

    await expect(service.uploadProfileImage("user-1", file())).rejects.toThrow(
      new NotFoundException("Rider not found"),
    );
  });

  it("uploads, presigns, and stores the new profile image", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      user: { profileImage: null },
    });

    const result = await service.uploadProfileImage("user-1", file());

    expect(result.profileImage.url).toBe("https://signed");
    expect(deps.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profileImage: expect.stringContaining(`riders/user-1/profile/`) },
    });
    expect(deps.storage.delete).not.toHaveBeenCalled();
  });

  it("deletes the replaced profile image and survives deletion errors", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      user: { profileImage: "riders/user-1/profile/old.jpg" },
    });
    deps.storage.delete.mockRejectedValueOnce(new Error("minio down"));

    const result = await service.uploadProfileImage("user-1", file());

    expect(deps.storage.delete).toHaveBeenCalledWith("riders/user-1/profile/old.jpg");
    expect(result.profileImage.url).toBe("https://signed");
  });

  it("maps unknown mimetypes to a jpg extension through the private helper", () => {
    expect((service as any).getFileExtension("image/png")).toBe("png");
    expect((service as any).getFileExtension("image/xyz")).toBe("jpg");
  });
});

describe("RiderProfileService.uploadIdentityDocuments", () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: RiderProfileService;

  beforeEach(() => {
    deps = makeDeps();
    service = new RiderProfileService(deps.prisma as any, deps.storage as any);
  });

  const front = file({ originalname: "front.jpg" });
  const back = file({ originalname: "back.jpg" });

  it("rejects a disallowed front mimetype", async () => {
    await expect(
      service.uploadIdentityDocuments("user-1", file({ mimetype: "image/gif" }), back),
    ).rejects.toThrow(/Invalid front file type/);
  });

  it("rejects an oversized front file", async () => {
    await expect(
      service.uploadIdentityDocuments("user-1", file({ size: 9 * 1024 * 1024 }), back),
    ).rejects.toThrow(/Front file too large/);
  });

  it("rejects a disallowed back mimetype", async () => {
    await expect(
      service.uploadIdentityDocuments("user-1", front, file({ mimetype: "image/gif" })),
    ).rejects.toThrow(/Invalid back file type/);
  });

  it("rejects an oversized back file", async () => {
    await expect(
      service.uploadIdentityDocuments("user-1", front, file({ size: 9 * 1024 * 1024 })),
    ).rejects.toThrow(/Back file too large/);
  });

  it("404s for unknown riders", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.uploadIdentityDocuments("user-1", front, back),
    ).rejects.toThrow(new NotFoundException("Rider not found"));
  });

  it("uploads both documents, replacing stored ones", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      identityFront: "riders/user-1/identity/old-front.jpg",
      identityBack: "riders/user-1/identity/old-back.jpg",
    });

    const result = await service.uploadIdentityDocuments("user-1", front, back);

    expect(deps.storage.delete).toHaveBeenCalledWith("riders/user-1/identity/old-front.jpg");
    expect(deps.storage.delete).toHaveBeenCalledWith("riders/user-1/identity/old-back.jpg");
    expect(deps.storage.uploadMultiple).toHaveBeenCalledWith([
      expect.objectContaining({
        objectName: "riders/user-1/identity/front.jpg",
        contentType: "image/jpeg",
      }),
      expect.objectContaining({
        objectName: "riders/user-1/identity/back.jpg",
        contentType: "image/jpeg",
      }),
    ]);
    expect(result.identityFront.url).toBe("https://signed");
    expect(result.identityBack.url).toBe("https://signed");
    expect(deps.prisma.rider.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        identityFront: "riders/user-1/identity/front.jpg",
        identityBack: "riders/user-1/identity/back.jpg",
      },
    });
  });

  it("skips deletion when no documents exist yet", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      identityFront: null,
      identityBack: null,
    });

    await service.uploadIdentityDocuments("user-1", front, back);

    expect(deps.storage.delete).not.toHaveBeenCalled();
  });

  it("ignores failures while deleting replaced documents", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      identityFront: "riders/user-1/identity/old-front.jpg",
      identityBack: "riders/user-1/identity/old-back.jpg",
    });
    deps.storage.delete.mockRejectedValue(new Error("minio down"));

    const result = await service.uploadIdentityDocuments("user-1", front, back);

    expect(result.identityFront.url).toBe("https://signed");
  });
});
