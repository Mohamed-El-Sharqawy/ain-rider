import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureStream = vi.fn().mockResolvedValue(undefined);
const drain = vi.fn().mockResolvedValue(undefined);
const fakePublisher = { publish: vi.fn() };

vi.mock("@ain-rider/nats-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ain-rider/nats-client")>();
  return {
    ...actual,
    createNatsConnection: vi.fn(async () => ({
      jetstream: () => ({}),
      drain,
    })),
    createPublisher: vi.fn(() => fakePublisher),
    createStreamManager: vi.fn(() => ({ ensureStream })),
  };
});

import { NatsService } from "../src/shared/nats/nats.service";

beforeEach(() => {
  ensureStream.mockClear().mockResolvedValue(undefined);
  drain.mockClear().mockResolvedValue(undefined);
  vi.restoreAllMocks();
});

describe("NatsService", () => {
  it("connects and ensures the auth streams with single-node dev settings", async () => {
    process.env.NODE_ENV = "test";
    const service = new NatsService();
    await service.onModuleInit();

    expect(ensureStream).toHaveBeenCalledWith(
      "AIN_RIDER_AUTH",
      expect.objectContaining({
        subjects: ["ain_rider.user.*", "ain_rider.otp.*"],
        replicas: 1,
        storage: "file",
      }),
    );
    expect(service.nc).toBeDefined();
    expect(service.publisher).toBe(fakePublisher);
  });

  it("requests 3 replicas in production", async () => {
    process.env.NODE_ENV = "production";
    const service = new NatsService();
    try {
      await service.onModuleInit();
      expect(ensureStream).toHaveBeenCalledWith(
        "AIN_RIDER_AUTH",
        expect.objectContaining({ replicas: 3 }),
      );
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  it("keeps booting when stream creation fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    ensureStream.mockRejectedValueOnce(new Error("jetstream down"));

    const service = new NatsService();
    await service.onModuleInit();

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to initialize streams"), expect.any(Error));
    expect(service.publisher).toBe(fakePublisher);
  });

  it("falls back to a localhost server when NATS_SERVERS is unset", async () => {
    const servers = process.env.NATS_SERVERS;
    delete process.env.NATS_SERVERS;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const service = new NatsService();
      await service.onModuleInit();
      expect(service.nc).toBeDefined();
      expect(log).toHaveBeenCalledWith("[NATS] auth-service connected");
    } finally {
      process.env.NATS_SERVERS = servers;
    }
  });

  it("drains the connection once on shutdown and survives drain errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    drain
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("drain failed"));

    const service = new NatsService();
    await service.onModuleInit();
    await service.onModuleDestroy();
    await service.onModuleDestroy(); // second call is a no-op
    expect(drain).toHaveBeenCalledTimes(1);

    const second = new NatsService();
    await second.onModuleInit();
    await second.onModuleDestroy();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Error draining connection"), expect.any(Error));
  });
});
