import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConsoleProvider } from "../src/auth/otp-providers/console.provider";
import { OtpService } from "../src/auth/otp.service";
import type { OtpProvider } from "../src/auth/otp-providers/otp-provider.interface";

function makeProvider(overrides: Partial<OtpProvider> = {}): OtpProvider {
  return {
    requestOtp: vi.fn().mockResolvedValue(undefined),
    verifyCode: vi.fn().mockResolvedValue({ phone_number: "+201000000000", uid: "u1" }),
    isInitialized: vi.fn().mockReturnValue(true),
    getName: vi.fn().mockReturnValue("mock"),
    ...overrides,
  };
}

function serviceWith(provider: OtpProvider): OtpService {
  const service = new OtpService();
  service.onModuleInit();
  (service as any).provider = provider;
  return service;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("OtpService provider selection", () => {
  it("selects the console provider when OTP_PROVIDER=console", () => {
    const service = new OtpService();
    service.onModuleInit();
    expect(service.getProviderName()).toBe("console");
  });

  it("falls back to the console provider for unknown provider names", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.OTP_PROVIDER = "smoke-signals";
    const service = new OtpService();
    try {
      service.onModuleInit();
      expect(service.getProviderName()).toBe("console");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider "smoke-signals"'),
      );
    } finally {
      process.env.OTP_PROVIDER = "console";
    }
  });

  it("defaults to the console provider when OTP_PROVIDER is unset", () => {
    const previous = process.env.OTP_PROVIDER;
    delete process.env.OTP_PROVIDER;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const service = new OtpService();
      service.onModuleInit();
      expect(service.getProviderName()).toBe("console");
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("Initializing with provider: console"),
      );
    } finally {
      process.env.OTP_PROVIDER = previous;
    }
  });

  it("warns when the selected provider is not fully initialized", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(ConsoleProvider.prototype, "isInitialized").mockReturnValueOnce(false);

    const service = new OtpService();
    service.onModuleInit();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not fully initialized"));
  });
});

describe("OtpService request/verify passthrough", () => {
  it("delegates requestOtp to the provider and resets the failure counter", async () => {
    const provider = makeProvider();
    const service = serviceWith(provider);

    await service.requestOtp("+201000000000", "trace-1");

    expect(provider.requestOtp).toHaveBeenCalledWith("+201000000000", "trace-1");
    expect(service.getCircuitBreakerStats()).toEqual({ failures: 0, isOpen: false });
  });

  it("returns the decoded token on successful verification", async () => {
    const provider = makeProvider();
    const service = serviceWith(provider);

    await expect(service.verifyCode("+201000000000", "123456", "trace-1")).resolves.toEqual({
      phone_number: "+201000000000",
      uid: "u1",
    });
  });

  it("wraps provider verification failures in UnauthorizedException", async () => {
    const provider = makeProvider({
      verifyCode: vi.fn().mockRejectedValue(new Error("Invalid or expired OTP code")),
    });
    const service = serviceWith(provider);

    await expect(service.verifyCode("p", "000000", "t")).rejects.toThrow(
      new UnauthorizedException("Invalid or expired OTP code"),
    );
    expect(service.getCircuitBreakerStats().failures).toBe(1);
  });

  it("maps provider capability errors to ServiceUnavailableException", async () => {
    const provider = makeProvider({
      verifyCode: vi.fn().mockRejectedValue(new Error("Firebase Admin does not support verifying plain codes")),
    });
    const service = serviceWith(provider);

    await expect(service.verifyCode("p", "000000", "t")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("maps missing provider configuration to ServiceUnavailableException", async () => {
    const provider = makeProvider({
      requestOtp: vi.fn().mockRejectedValue(new Error("provider not configured")),
    });
    const service = serviceWith(provider);

    await expect(service.requestOtp("p", "t")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("falls back to a default message for non-Error provider failures", async () => {
    const provider = makeProvider({
      verifyCode: vi.fn().mockRejectedValue("total meltdown"),
    });
    const service = serviceWith(provider);

    await expect(service.verifyCode("p", "000000", "t")).rejects.toThrow(
      new UnauthorizedException("Invalid or expired OTP token"),
    );
  });

  it("rethrows provider failures that are already ServiceUnavailableException", async () => {
    const original = new ServiceUnavailableException("upstream down");
    const provider = makeProvider({ verifyCode: vi.fn().mockRejectedValue(original) });
    const service = serviceWith(provider);

    await expect(service.verifyCode("p", "000000", "t")).rejects.toBe(original);
  });
});

describe("OtpService circuit breaker (retry/throttle limits)", () => {
  function failingService(): { service: OtpService; provider: OtpProvider } {
    const provider = makeProvider({
      verifyCode: vi.fn().mockRejectedValue(new Error("Invalid or expired OTP code")),
    });
    return { service: serviceWith(provider), provider };
  }

  it("opens the circuit after 5 consecutive provider failures and throttles further attempts", async () => {
    const { service } = failingService();

    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyCode("p", "000000", "t")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    expect(service.isCircuitBreakerOpen()).toBe(true);

    await expect(service.verifyCode("p", "000000", "t")).rejects.toThrow(
      new ServiceUnavailableException(
        "OTP verification service is temporarily unavailable. Please try again later.",
      ),
    );
  });

  it("throttles requestOtp too while the circuit is open", async () => {
    const provider = makeProvider({
      requestOtp: vi.fn().mockRejectedValue(new Error("send failed")),
    });
    const service = serviceWith(provider);

    for (let i = 0; i < 5; i += 1) {
      await expect(service.requestOtp("p", "t")).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(service.requestOtp("p", "t")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(provider.requestOtp).toHaveBeenCalledTimes(5);
  });

  it("allows a half-open attempt after the timeout and re-opens when it fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { service, provider } = failingService();

    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyCode("p", "000000", "t")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    expect(service.isCircuitBreakerOpen()).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:00:31Z"));

    await expect(service.verifyCode("p", "000000", "t")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(provider.verifyCode).toHaveBeenCalled();
    expect(service.isCircuitBreakerOpen()).toBe(true);
  });

  it("closes the circuit when the half-open attempt succeeds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { service, provider } = failingService();

    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyCode("p", "000000", "t")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }

    vi.setSystemTime(new Date("2026-01-01T00:00:31Z"));
    (provider.verifyCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      phone_number: "p",
      uid: "u1",
    });

    await expect(service.verifyCode("p", "123456", "t")).resolves.toBeTruthy();
    expect(service.isCircuitBreakerOpen()).toBe(false);
    expect(service.getCircuitBreakerStats()).toEqual({ failures: 0, isOpen: false });
  });
});
