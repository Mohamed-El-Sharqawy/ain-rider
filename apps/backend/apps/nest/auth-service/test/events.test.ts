import { describe, expect, it, vi, beforeEach } from "vitest";

const { publishCalls } = vi.hoisted(() => ({
  publishCalls: [] as Array<{
    subject: string;
    eventType: string;
    data: unknown;
    opts: any;
  }>,
}));

vi.mock("@ain-rider/nats-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ain-rider/nats-client")>();
  class FakeJetStreamPublisher {
    constructor(
      public nc: unknown,
      public serviceName?: string,
    ) {}
    async publish(subject: string, eventType: string, data: unknown, opts?: any) {
      publishCalls.push({ subject, eventType, data, opts });
      return { success: true, dupe: false };
    }
  }
  return { ...actual, JetStreamPublisher: FakeJetStreamPublisher as any };
});

import { UserEventPublisher } from "../src/events/user-event.publisher";
import { DriverEventPublisher } from "../src/events/driver-event.publisher";
import { NATS_SUBJECTS } from "@ain-rider/shared-types";

function makeUser() {
  return {
    id: "user-1",
    email: "user@test.ainrider",
    phoneNumber: "+201000000000",
    firstName: "Test",
    lastName: "User",
    role: "RIDER",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  } as any;
}

beforeEach(() => {
  publishCalls.length = 0;
});

describe("UserEventPublisher", () => {
  const nats = { nc: {} } as any;
  const publisher = new UserEventPublisher(nats);

  it("publishes user_created with a full envelope", async () => {
    await publisher.publishUserCreated(makeUser(), "trace-1");

    expect(publishCalls).toHaveLength(1);
    expect(publishCalls[0]).toMatchObject({
      subject: NATS_SUBJECTS.USER_CREATED,
      eventType: "user_created",
      opts: { traceId: "trace-1" },
      data: {
        id: "user-1",
        email: "user@test.ainrider",
        role: "RIDER",
        status: "ACTIVE",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("publishes user_updated with only the changed fields", async () => {
    await publisher.publishUserUpdated(
      makeUser(),
      { firstName: "New" },
      "admin-1",
      "trace-2",
    );

    expect(publishCalls[0]).toMatchObject({
      subject: NATS_SUBJECTS.USER_UPDATED,
      eventType: "user_updated",
      data: { id: "user-1", firstName: "New", updatedAt: "2026-01-02T00:00:00.000Z" },
      opts: { traceId: "trace-2" },
    });
  });

  it("logs N/A when a user_updated event has no actor", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await publisher.publishUserUpdated(makeUser(), {}, undefined, "trace-2b");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("updatedBy=N/A"));
  });

  it("publishes user_status_changed with null for a missing reason", async () => {
    await publisher.publishUserStatusChanged(makeUser(), "ACTIVE", "admin-1", undefined, "trace-3");

    expect(publishCalls[0]).toMatchObject({
      subject: NATS_SUBJECTS.USER_STATUS_CHANGED,
      eventType: "user_status_changed",
      data: {
        id: "user-1",
        previousStatus: "ACTIVE",
        newStatus: "ACTIVE",
        changedBy: "admin-1",
        reason: null,
      },
    });
  });

  it("publishes user_deleted", async () => {
    await publisher.publishUserDeleted("user-9", "admin-1", "gdpr", "trace-4");

    expect(publishCalls[0]).toMatchObject({
      subject: NATS_SUBJECTS.USER_DELETED,
      eventType: "user_deleted",
      data: { id: "user-9", deletedBy: "admin-1", deletionReason: "gdpr" },
    });
    expect(typeof (publishCalls[0].data as any).deletedAt).toBe("string");
  });

  it("publishes user_deleted without a reason as null", async () => {
    await publisher.publishUserDeleted("user-9", "admin-1", undefined, "trace-4b");

    expect(publishCalls[0].data).toMatchObject({ deletionReason: null });
  });

  it("publishes otp_verified for the downstream consumers", async () => {
    await publisher.publishOtpVerified("+201000000000", "uid-1", "trace-5");

    expect(publishCalls[0]).toMatchObject({
      subject: NATS_SUBJECTS.OTP_VERIFIED,
      eventType: "otp_verified",
      data: { phoneNumber: "+201000000000", uid: "uid-1" },
      opts: { traceId: "trace-5" },
    });
    expect(typeof (publishCalls[0].data as any).verifiedAt).toBe("string");
  });
});

describe("DriverEventPublisher", () => {
  it("wraps the driver payload into a DRIVER_APPROVED event", async () => {
    const natsPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const publisher = new DriverEventPublisher(natsPublisher as any);

    await publisher.publishDriverApproved({ userId: "driver-1" });

    expect(natsPublisher.publish).toHaveBeenCalledWith({
      type: "DRIVER_APPROVED",
      subject: NATS_SUBJECTS.DRIVER_APPROVED,
      data: { userId: "driver-1" },
    });
  });
});
