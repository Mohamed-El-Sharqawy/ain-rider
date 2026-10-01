import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "../src/auth/jwt.strategy";

function makeConfig(secret?: string) {
  return { get: vi.fn().mockReturnValue(secret) };
}

describe("JwtStrategy", () => {
  it("refuses to start without JWT_SECRET", () => {
    expect(() => new JwtStrategy({ validateUser: vi.fn() } as any, makeConfig(undefined) as any)).toThrow(
      "[JwtStrategy] FATAL: JWT_SECRET environment variable is required. Refusing to start.",
    );
  });

  it("constructs with the configured secret", () => {
    const strategy = new JwtStrategy({ validateUser: vi.fn() } as any, makeConfig("s3cret") as any);
    expect(strategy).toBeDefined();
  });

  it("rejects payloads that are not access tokens", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const strategy = new JwtStrategy({ validateUser: vi.fn() } as any, makeConfig("s3cret") as any);

    await expect(strategy.validate({ type: "refresh", sub: "u1" })).rejects.toThrow(
      new UnauthorizedException("Invalid token type"),
    );
    expect(log).toHaveBeenCalledWith("[JwtStrategy] Invalid token type:", "refresh");
  });

  it("rejects payloads for unknown users", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const authService = { validateUser: vi.fn().mockResolvedValue(null) };
    const strategy = new JwtStrategy(authService as any, makeConfig("s3cret") as any);

    await expect(strategy.validate({ type: "access", sub: "ghost" })).rejects.toThrow(
      new UnauthorizedException("User not found"),
    );
    expect(authService.validateUser).toHaveBeenCalledWith("ghost");
  });

  it("returns the user for valid access payloads", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const user = { id: "u1", email: "a@b.c", role: "RIDER" };
    const strategy = new JwtStrategy(
      { validateUser: vi.fn().mockResolvedValue(user) } as any,
      makeConfig("s3cret") as any,
    );

    await expect(strategy.validate({ type: "access", sub: "u1" })).resolves.toBe(user);
  });
});
