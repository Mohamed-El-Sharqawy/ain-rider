import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthController } from "../src/auth/auth.controller";
import { UserRole } from "@ain-rider/shared-types";

function makeDeps() {
  return {
    authService: {},
    storage: {
      getPresignedGetUrl: vi
        .fn()
        .mockResolvedValue({ url: "https://signed", expiresAt: new Date() }),
    },
    prisma: {
      rider: { findUnique: vi.fn().mockResolvedValue(null) },
    },
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "u@test.ainrider",
    role: UserRole.RIDER,
    profileImage: undefined,
    passwordHash: "hashed",
    ...overrides,
  };
}

describe("AuthController.me image resolution", () => {
  let deps: ReturnType<typeof makeDeps>;
  let controller: AuthController;

  beforeEach(() => {
    deps = makeDeps();
    controller = new AuthController(
      deps.authService as any,
      deps.storage as any,
      deps.prisma as any,
    );
  });

  it("returns the sanitized user without images when none are set", async () => {
    const result = await controller.me({ user: makeUser() });

    expect(result).toMatchObject({ id: "user-1", images: {} });
    expect(result.passwordHash).toBeUndefined();
    expect(deps.prisma.rider.findUnique).toHaveBeenCalled();
  });

  it("presigns profile and identity images for riders", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      identityFront: "riders/user-1/identity/front.jpg",
      identityBack: "riders/user-1/identity/back.jpg",
    });

    const result = await controller.me({
      user: makeUser({ profileImage: "riders/user-1/profile/me.jpg" }),
    });

    expect(result.images.profileImage).toMatchObject({ url: "https://signed" });
    expect(result.images.identityFront).toMatchObject({ url: "https://signed" });
    expect(result.images.identityBack).toMatchObject({ url: "https://signed" });
  });

  it("falls back to null for a profile image that cannot be presigned", async () => {
    deps.storage.getPresignedGetUrl.mockRejectedValueOnce(new Error("minio down"));

    const result = await controller.me({
      user: makeUser({ profileImage: "riders/user-1/profile/me.jpg" }),
    });

    expect(result.images.profileImage).toBeNull();
  });

  it("falls back to null per identity document that cannot be presigned", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      identityFront: "riders/user-1/identity/front.jpg",
      identityBack: "riders/user-1/identity/back.jpg",
    });
    deps.storage.getPresignedGetUrl
      .mockRejectedValueOnce(new Error("minio down"))
      .mockResolvedValueOnce({ url: "https://signed", expiresAt: new Date() });

    const result = await controller.me({ user: makeUser() });

    expect(result.images.identityFront).toBeNull();
    expect(result.images.identityBack).toMatchObject({ url: "https://signed" });
  });

  it("falls back to null for the back document when only it cannot be presigned", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      identityFront: "riders/user-1/identity/front.jpg",
      identityBack: "riders/user-1/identity/back.jpg",
    });
    deps.storage.getPresignedGetUrl
      .mockResolvedValueOnce({ url: "https://signed", expiresAt: new Date() })
      .mockRejectedValueOnce(new Error("minio down"));

    const result = await controller.me({ user: makeUser() });

    expect(result.images.identityFront).toMatchObject({ url: "https://signed" });
    expect(result.images.identityBack).toBeNull();
  });

  it("skips identity lookups for non-riders", async () => {
    const result = await controller.me({ user: makeUser({ role: UserRole.DRIVER }) });

    expect(result.images).toEqual({});
    expect(deps.prisma.rider.findUnique).not.toHaveBeenCalled();
  });

  it("omits identity urls for riders without stored documents", async () => {
    deps.prisma.rider.findUnique.mockResolvedValueOnce({
      identityFront: null,
      identityBack: null,
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await controller.me({ user: makeUser() });

    expect(result.images).toEqual({});
    expect(deps.storage.getPresignedGetUrl).not.toHaveBeenCalled();
  });
});
