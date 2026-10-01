import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";

const { registered, instances, FakeNatsResponder } = vi.hoisted(() => {
  const registered: Array<{
    subject: string;
    handler: (data: any) => Promise<any>;
  }> = [];
  const instances: any[] = [];

  class FakeNatsResponder {
    closed = false;
    constructor(public nc: unknown) {
      instances.push(this);
    }
    async respond(subject: string, handler: (data: any) => Promise<any>) {
      registered.push({ subject, handler });
    }
    async close() {
      this.closed = true;
    }
  }

  return { registered, instances, FakeNatsResponder };
});

vi.mock("@ain-rider/nats-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ain-rider/nats-client")>();
  return { ...actual, NatsResponder: FakeNatsResponder as any };
});

import { UserSuspendResponder } from "../src/nats/responders/user-suspend.responder";
import { UserActivateResponder } from "../src/nats/responders/user-activate.responder";
import { AdminCommandHandler } from "../src/nats/responders/admin-command.handler";

function handlerFor(subject: string) {
  const entry = registered.find((r) => r.subject === subject);
  if (!entry) throw new Error(`no handler registered for ${subject}`);
  return entry.handler;
}

function authServiceMock() {
  return {
    updateUserStatus: vi
      .fn()
      .mockImplementation(async (_userId: string, status: string) => ({
        id: "user-1",
        status,
      })),
  };
}

function onboardingMock() {
  return {
    approveDriver: vi.fn().mockResolvedValue([{ id: "d1" }]),
    rejectDocument: vi.fn().mockResolvedValue([]),
    approveDocument: vi.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  registered.length = 0;
  instances.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("UserSuspendResponder", () => {
  it("gives up when NATS never connects", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const responder = new UserSuspendResponder(authServiceMock() as any, { nc: null } as any);

    const done = responder.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_100);
    await done;

    expect(registered).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("not available after 5s"));
  });

  it("suspends users on request and rejects incomplete payloads", async () => {
    const authService = authServiceMock();
    const responder = new UserSuspendResponder(authService as any, { nc: {} } as any);
    await responder.onModuleInit();

    const handler = handlerFor("user.suspend.request");

    await expect(handler({ userId: "user-1" })).rejects.toThrow(
      "Missing required fields: userId, suspendedBy",
    );

    await expect(
      handler({ userId: "user-1", reason: "abuse", suspendedBy: "admin-1" }),
    ).resolves.toEqual({ userId: "user-1", newStatus: "SUSPENDED" });
    expect(authService.updateUserStatus).toHaveBeenCalledWith("user-1", "SUSPENDED");

    await responder.onModuleDestroy();
  });
});

describe("UserActivateResponder", () => {
  it("gives up when NATS never connects", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const responder = new UserActivateResponder(authServiceMock() as any, { nc: null } as any);

    const done = responder.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_100);
    await done;

    expect(registered).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("not available after 5s"));
  });

  it("activates users on request", async () => {
    const authService = authServiceMock();
    const responder = new UserActivateResponder(authService as any, { nc: {} } as any);
    await responder.onModuleInit();

    const handler = handlerFor("user.activate.request");

    await expect(handler({ userId: "user-1" })).rejects.toThrow(
      "Missing required fields: userId, activatedBy",
    );

    await expect(handler({ userId: "user-1", activatedBy: "admin-1" })).resolves.toEqual({
      userId: "user-1",
      newStatus: "ACTIVE",
    });
    expect(authService.updateUserStatus).toHaveBeenCalledWith("user-1", "ACTIVE");

    await responder.onModuleDestroy();
  });
});

describe("AdminCommandHandler", () => {
  async function boot() {
    const authService = authServiceMock();
    const onboarding = onboardingMock();
    const handler = new AdminCommandHandler(
      authService as any,
      onboarding as any,
      { nc: {} } as any,
    );
    await handler.onModuleInit();
    return { handler, authService, onboarding };
  }

  it("gives up when NATS never connects", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = new AdminCommandHandler(
      authServiceMock() as any,
      onboardingMock() as any,
      { nc: null } as any,
    );

    const done = handler.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_100);
    await done;

    expect(registered).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      "[AdminCommandHandler] NATS connection not available",
    );
  });

  it("registers all six admin command subjects", async () => {
    await boot();
    expect(registered.map((r) => r.subject).sort()).toEqual(
      [
        "admin.command.activate_user",
        "admin.command.approve_driver",
        "admin.command.approve_driver_document",
        "admin.command.reject_driver_document",
        "admin.command.suspend_user",
        "admin.command.update_user_status",
      ].sort(),
    );
  });

  it("validates required fields on suspend_user", async () => {
    const { handler } = await boot();

    await expect(
      handlerFor("admin.command.suspend_user")({ userId: "user-1", adminId: "a1" }),
    ).rejects.toThrow(new BadRequestException("Missing required field: reason"));

    await expect(
      handlerFor("admin.command.suspend_user")({
        userId: "user-1",
        reason: "abuse",
        adminId: "a1",
      }),
    ).resolves.toEqual({ success: true });
  });

  it("activates users", async () => {
    const { authService } = await boot();

    await expect(
      handlerFor("admin.command.activate_user")({ userId: "user-1", adminId: "a1" }),
    ).resolves.toEqual({ success: true });
    expect(authService.updateUserStatus).toHaveBeenCalledWith("user-1", "ACTIVE", "a1");
  });

  it("approves drivers", async () => {
    const { onboarding } = await boot();

    await expect(
      handlerFor("admin.command.approve_driver")({ userId: "user-1", adminId: "a1" }),
    ).resolves.toEqual({ success: true });
    expect(onboarding.approveDriver).toHaveBeenCalledWith("user-1");

    await expect(
      handlerFor("admin.command.approve_driver")({ userId: "user-1" }),
    ).rejects.toThrow(new BadRequestException("Missing required field: adminId"));
  });

  it("validates the document stage when rejecting", async () => {
    const { onboarding } = await boot();

    await expect(
      handlerFor("admin.command.reject_driver_document")({
        userId: "user-1",
        stage: "bogus",
        reason: "blurry",
        adminId: "a1",
      }),
    ).rejects.toThrow(
      "Invalid value for stage: bogus. Allowed: identity, license, vehicle",
    );

    await expect(
      handlerFor("admin.command.reject_driver_document")({
        userId: "user-1",
        stage: "identity",
        reason: "blurry",
        adminId: "a1",
      }),
    ).resolves.toEqual({ success: true });
    expect(onboarding.rejectDocument).toHaveBeenCalledWith("user-1", "identity", "blurry");
  });

  it("approves driver documents for any valid stage", async () => {
    const { onboarding } = await boot();
    const handler = handlerFor("admin.command.approve_driver_document");

    await expect(
      handler({ userId: "user-1", stage: "vehicle", adminId: "a1" }),
    ).resolves.toEqual({ success: true });
    expect(onboarding.approveDocument).toHaveBeenCalledWith("user-1", "vehicle");

    await expect(handler({ userId: "user-1", adminId: "a1" })).rejects.toThrow(
      new BadRequestException("Missing required field: stage"),
    );
  });

  it("updates arbitrary valid user statuses", async () => {
    const { authService } = await boot();

    await expect(
      handlerFor("admin.command.update_user_status")({
        userId: "user-1",
        status: "REJECTED",
        adminId: "a1",
        reason: "bad docs",
      }),
    ).resolves.toEqual({ success: true, newStatus: "REJECTED" });
    expect(authService.updateUserStatus).toHaveBeenCalledWith(
      "user-1",
      "REJECTED",
      "a1",
      "bad docs",
    );
  });

  it("closes the responder on shutdown", async () => {
    const { handler } = await boot();
    expect(handler).toBeDefined();

    await handler.onModuleDestroy();
    expect(instances[0].closed).toBe(true);
  });
});
