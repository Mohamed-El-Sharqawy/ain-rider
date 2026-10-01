import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../src/generated/prisma/client";
import { AuthService } from "../src/auth/auth.service";

const { bcryptCompare } = vi.hoisted(() => ({ bcryptCompare: vi.fn() }));

vi.mock("bcrypt", () => ({
  compare: bcryptCompare,
  hash: async () => "hashed",
  default: { compare: bcryptCompare, hash: async () => "hashed" },
}));

function p2002(meta: Record<string, unknown> = { target: ["users_email_key"] }) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta,
  });
}

function makePrisma() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    driver: {
      create: vi.fn().mockResolvedValue({ id: "d1" }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
    rider: {
      create: vi.fn().mockResolvedValue({ id: "r1" }),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(async (input: any) =>
      Array.isArray(input) ? input : input({ refreshToken: { update: vi.fn(), findUnique: vi.fn(), create: vi.fn() } }),
    ),
  };
}

function makeDeps() {
  const prisma = makePrisma();
  const jwtService = {
    sign: vi.fn().mockReturnValue("signed-token"),
    verify: vi.fn(),
  };
  const userEventPublisher = {
    publishUserCreated: vi.fn().mockResolvedValue(undefined),
    publishUserStatusChanged: vi.fn().mockResolvedValue(undefined),
    publishOtpVerified: vi.fn().mockResolvedValue(undefined),
  };
  const otpService = {
    requestOtp: vi.fn().mockResolvedValue(undefined),
    verifyCode: vi
      .fn()
      .mockResolvedValue({ phone_number: "+201000000000", uid: "uid-1" }),
  };
  return { prisma, jwtService, userEventPublisher, otpService };
}

function makeService(overrides: Partial<ReturnType<typeof makeDeps>> = {}) {
  const deps = { ...makeDeps(), ...overrides };
  const service = new AuthService(
    deps.prisma as any,
    deps.jwtService as any,
    deps.userEventPublisher as any,
    deps.otpService as any,
  );
  return { service, ...deps };
}

const USER = {
  id: "user-1",
  email: "u@test.ainrider",
  phoneNumber: "+201000000000",
  passwordHash: "hashed",
  firstName: "Test",
  lastName: "User",
  role: "RIDER",
  status: "ACTIVE",
};

const REGISTER_DTO = {
  email: "u@test.ainrider",
  phoneNumber: "+201000000000",
  password: "secret-pass",
  firstName: "Test",
  lastName: "User",
  role: "RIDER" as const,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("AuthService.register", () => {
  it("creates the user, the rider profile, tokens, and publishes user_created", async () => {
    const { service, prisma, userEventPublisher } = makeService();
    prisma.user.create.mockResolvedValueOnce({ ...USER });

    const result = await service.register(REGISTER_DTO);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: REGISTER_DTO.email, role: "RIDER" }),
    });
    expect(prisma.rider.create).toHaveBeenCalledWith({ data: { userId: "user-1" } });
    expect(result.user.passwordHash).toBeUndefined();
    expect(result.user.email).toBe(USER.email);
    expect(result.accessToken).toBe("signed-token");
    expect(result.refreshToken).toBe("signed-token");
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", family: expect.any(String) }),
      }),
    );
    expect(userEventPublisher.publishUserCreated).toHaveBeenCalled();
  });

  it("creates a driver profile for DRIVER registrations", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockResolvedValueOnce({ ...USER, role: "DRIVER" });

    await service.register({ ...REGISTER_DTO, role: "DRIVER" as const });

    expect(prisma.driver.create).toHaveBeenCalledWith({ data: { userId: "user-1" } });
    expect(prisma.rider.create).not.toHaveBeenCalled();
  });

  it("maps duplicate email conflicts to 409", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(p2002({ target: ["users_email_key"] }));

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(
      new ConflictException("Email already registered"),
    );
  });

  it("maps duplicate phone conflicts to 409", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(
      p2002({
        driverAdapterError: { cause: { constraint: { index: "users_phoneNumber_key" } } },
      }),
    );

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(
      new ConflictException("Phone number already registered"),
    );
  });

  it("maps other unique conflicts to a generic 409", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(p2002({ target: ["something_else"] }));

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(
      new ConflictException("User already exists with these credentials"),
    );
  });

  it("reads the constraint from driver adapter errors without an index", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(
      p2002({ driverAdapterError: { cause: { constraint: "users_email_key" } } }),
    );

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(
      new ConflictException("Email already registered"),
    );
  });

  it("falls back to the generic conflict when no constraint info exists", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(p2002({}));

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(
      new ConflictException("User already exists with these credentials"),
    );
  });

  it("accepts string-shaped constraint targets", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(p2002({ target: "users_email_key" as any }));

    await expect(service.register(REGISTER_DTO)).rejects.toThrow(
      new ConflictException("Email already registered"),
    );
  });

  it("rethrows non-conflict errors", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(new Error("db down"));

    await expect(service.register(REGISTER_DTO)).rejects.toThrow("db down");
  });

  it("does not fail the request when the user_created event cannot publish", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { service, prisma, userEventPublisher } = makeService();
    prisma.user.create.mockResolvedValueOnce({ ...USER });
    userEventPublisher.publishUserCreated.mockRejectedValueOnce(new Error("nats down"));

    const result = await service.register(REGISTER_DTO);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.accessToken).toBe("signed-token");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to publish user_created"));
  });
});

describe("AuthService.login", () => {
  it("rejects unknown emails and wrong passwords", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.login("ghost@test.ainrider", "pw123456")).rejects.toThrow(
      new UnauthorizedException("Invalid credentials"),
    );

    prisma.user.findUnique.mockResolvedValueOnce({ ...USER });
    bcryptCompare.mockResolvedValueOnce(false);

    await expect(service.login(USER.email, "pw123456")).rejects.toThrow(
      new UnauthorizedException("Invalid credentials"),
    );
  });

  it("issues tokens for valid credentials", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ ...USER });
    bcryptCompare.mockResolvedValueOnce(true);

    const result = await service.login(USER.email, "pw123456");

    expect(result.user.passwordHash).toBeUndefined();
    expect(result.refreshToken).toBe("signed-token");
  });
});

describe("AuthService.verifyToken", () => {
  it("rejects invalid tokens", () => {
    const { service, jwtService } = makeService();
    jwtService.verify.mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    expect(() => service.verifyToken("bad")).toThrow(
      new UnauthorizedException("Invalid token"),
    );
  });

  it("returns the payload for valid tokens", () => {
    const { service, jwtService } = makeService();
    jwtService.verify.mockReturnValueOnce({ sub: "user-1" });

    expect(service.verifyToken("good")).toEqual({ sub: "user-1" });
  });
});

describe("AuthService.refresh", () => {
  it("rejects unknown tokens", async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValueOnce(null);

    await expect(service.refresh("unknown")).rejects.toThrow(
      new UnauthorizedException("Invalid or expired refresh token"),
    );
  });

  it("revokes the whole family when a revoked token is reused", async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      family: "f1",
      revoked: true,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.refresh("reused")).rejects.toThrow(
      new UnauthorizedException("Invalid or expired refresh token"),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { family: "f1" },
      data: { revoked: true },
    });
  });

  it("rejects expired tokens without touching the family", async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      family: "f1",
      revoked: false,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.refresh("stale")).rejects.toThrow(
      new UnauthorizedException("Invalid or expired refresh token"),
    );
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("rejects when the token owner no longer exists", async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      userId: "gone",
      family: "f1",
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.refresh("valid-but-orphaned")).rejects.toThrow(
      new UnauthorizedException("User not found"),
    );
  });

  it("rotates the token inside a transaction", async () => {
    const { service, prisma } = makeService();
    prisma.refreshToken.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      family: "f1",
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValueOnce({ ...USER });

    const tx = {
      refreshToken: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1" }),
        create: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await service.refresh("old-token");

    expect(result).toEqual({ accessToken: "signed-token", refreshToken: "signed-token" });
    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
      data: { revoked: true },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", family: "f1" }),
    });
  });
});

describe("AuthService.updateUserStatus", () => {
  it("rejects unknown users", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.updateUserStatus("ghost", "ACTIVE")).rejects.toThrow(
      new UnauthorizedException("User not found"),
    );
  });

  it("rejects invalid status transitions", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ ...USER, status: "ACTIVE" });

    await expect(service.updateUserStatus("user-1", "ACTIVE")).rejects.toThrow(
      new ConflictException("Invalid user status transition: ACTIVE → ACTIVE"),
    );
  });

  it.each([
    ["PENDING_DOCUMENTS", "ACTIVE", "APPROVED"],
    ["ACTIVE", "PENDING_DOCUMENTS", "PENDING_DOCUMENTS"],
    ["PENDING_DOCUMENTS", "UNDER_REVIEW", "UNDER_REVIEW"],
    ["PENDING_DOCUMENTS", "REJECTED", "REJECTED"],
  ])("syncs driver onboarding status when transitioning %s → %s", async (previous, status, onboarding) => {
    const { service, prisma, userEventPublisher } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({
      ...USER,
      role: "DRIVER",
      status: previous,
    });
    prisma.user.update.mockResolvedValueOnce({ ...USER, role: "DRIVER", status });

    const result = await service.updateUserStatus("user-1", status, "admin-1", "reason");

    expect(prisma.driver.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { onboardingStatus: onboarding },
    });
    expect(userEventPublisher.publishUserStatusChanged).toHaveBeenCalledWith(
      expect.anything(),
      previous,
      "admin-1",
      "reason",
      expect.any(String),
    );
    expect(result.passwordHash).toBeUndefined();
  });

  it("skips onboarding sync for statuses without a mapping", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ ...USER, role: "DRIVER", status: "ACTIVE" });
    prisma.user.update.mockResolvedValueOnce({ ...USER, role: "DRIVER", status: "SUSPENDED" });

    await service.updateUserStatus("user-1", "SUSPENDED");

    expect(prisma.driver.updateMany).not.toHaveBeenCalled();
  });

  it("defaults the changedBy actor to SYSTEM", async () => {
    const { service, prisma, userEventPublisher } = makeService();
    prisma.user.findUnique.mockResolvedValueOnce({ ...USER });
    prisma.user.update.mockResolvedValueOnce({ ...USER, status: "SUSPENDED" });

    await service.updateUserStatus("user-1", "SUSPENDED");

    expect(userEventPublisher.publishUserStatusChanged).toHaveBeenCalledWith(
      expect.anything(),
      "ACTIVE",
      "SYSTEM",
      undefined,
      expect.any(String),
    );
  });
});

describe("AuthService.adminCreateUser", () => {
  it("creates the user and publishes the event", async () => {
    const { service, prisma, userEventPublisher } = makeService();
    prisma.user.create.mockResolvedValueOnce({ ...USER });

    const result = await service.adminCreateUser({ ...REGISTER_DTO, role: "ADMIN" }, "admin-9");

    expect(result).toMatchObject({ createdBy: "admin-9", user: { email: USER.email } });
    expect(userEventPublisher.publishUserCreated).toHaveBeenCalled();
  });

  it("maps duplicate conflicts to 409", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(p2002({ target: ["users_email_key"] }));

    await expect(
      service.adminCreateUser({ ...REGISTER_DTO, role: "SUPPORT" }, "admin-9"),
    ).rejects.toThrow(new ConflictException("Email already registered"));
  });

  it("rethrows non-conflict errors", async () => {
    const { service, prisma } = makeService();
    prisma.user.create.mockRejectedValueOnce(new Error("db down"));

    await expect(
      service.adminCreateUser({ ...REGISTER_DTO, role: "SUPPORT" }, "admin-9"),
    ).rejects.toThrow("db down");
  });
});

describe("AuthService admin queries", () => {
  it("builds filters for findAllUsers and counts", async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany.mockResolvedValueOnce([{ ...USER }]);
    prisma.user.count.mockResolvedValueOnce(1);

    const result = await service.findAllUsers({
      skip: 10,
      take: 5,
      role: "RIDER",
      status: "ACTIVE",
      search: "test",
    });

    expect(result.total).toBe(1);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
        where: {
          role: "RIDER",
          status: "ACTIVE",
          OR: expect.any(Array),
        },
      }),
    );
    const where = (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
    expect(where.OR).toHaveLength(4);
  });

  it("queries without filters when none are given", async () => {
    const { service, prisma } = makeService();

    await service.findAllUsers({});

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: undefined, take: undefined }),
    );
  });

  it("updates users and sanitizes the result", async () => {
    const { service, prisma } = makeService();
    prisma.user.update.mockResolvedValueOnce({ ...USER, firstName: "Changed" });

    const result = await service.updateUser("user-1", { firstName: "Changed" });

    expect(result.firstName).toBe("Changed");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ firstName: "Changed" }),
    });
  });

  it("finds a user with rider/driver relations or returns null", async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique
      .mockResolvedValueOnce({ ...USER, driver: null, rider: { id: "r1" } })
      .mockResolvedValueOnce(null);

    expect(await service.findUserById("user-1")).toMatchObject({ id: "user-1" });
    expect(await service.findUserById("ghost")).toBeNull();
  });

  it("aggregates user stats", async () => {
    const { service, prisma } = makeService();
    prisma.user.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(70);

    await expect(service.getUserStats()).resolves.toEqual({
      total: 100,
      active: 80,
      drivers: 30,
      riders: 70,
    });
  });
});

describe("AuthService OTP passthrough", () => {
  it("signs refresh tokens with an empty family when none is given", () => {
    const { service, jwtService } = makeService();

    (service as any).signRefreshToken({ id: "u1", email: "e", role: "RIDER" });

    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ type: "refresh", family: "", jti: expect.any(String) }),
      { expiresIn: "7d" },
    );
  });

  it("delegates requestOtp", async () => {
    const { service, otpService } = makeService();

    await expect(service.requestOtp("+201000000000", "trace-1")).resolves.toEqual({
      success: true,
    });
    expect(otpService.requestOtp).toHaveBeenCalledWith("+201000000000", "trace-1");
  });

  it("returns a session for registered phones after OTP verification", async () => {
    const { service, prisma, otpService, userEventPublisher } = makeService();
    prisma.user.findFirst.mockResolvedValueOnce({ ...USER });

    const result = await service.verifyOtp("+201000000000", "123456", "trace-1");

    expect(otpService.verifyCode).toHaveBeenCalledWith("+201000000000", "123456", "trace-1");
    expect(userEventPublisher.publishOtpVerified).toHaveBeenCalledWith(
      "+201000000000",
      "uid-1",
      "trace-1",
    );
    expect(result).toMatchObject({
      success: true,
      isRegistered: true,
      phoneNumber: "+201000000000",
      uid: "uid-1",
    });
    expect(result.accessToken).toBe("signed-token");
    expect(result.user.passwordHash).toBeUndefined();
  });

  it("flags unregistered phones so the app can continue to registration", async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValueOnce(null);

    const result = await service.verifyOtp("+201999999999", "123456", "trace-1");

    expect(result).toMatchObject({ success: true, isRegistered: false });
    expect(result.accessToken).toBeUndefined();
  });

  it("does not fail verification when the otp_verified event cannot publish", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { service, userEventPublisher } = makeService();
    userEventPublisher.publishOtpVerified.mockRejectedValueOnce(new Error("nats down"));
    (service as any).prisma.user.findFirst.mockResolvedValueOnce(null);

    const result = await service.verifyOtp("+201000000000", "123456", "trace-1");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.success).toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to publish otp_verified"));
  });
});
