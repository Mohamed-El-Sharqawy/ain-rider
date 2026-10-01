import { describe, expect, it, vi } from "vitest";
import { jwtModuleFactory } from "../src/auth/auth.module";

describe("jwtModuleFactory", () => {
  it("returns the configured secret", () => {
    const config = { get: vi.fn().mockReturnValue("s3cret") };

    expect(jwtModuleFactory(config as any)).toEqual({ secret: "s3cret" });
  });

  it("refuses to start without JWT_SECRET", () => {
    const config = { get: vi.fn().mockReturnValue(undefined) };

    expect(() => jwtModuleFactory(config as any)).toThrow(
      "[AuthModule] FATAL: JWT_SECRET environment variable is required. Refusing to start.",
    );
  });
});
