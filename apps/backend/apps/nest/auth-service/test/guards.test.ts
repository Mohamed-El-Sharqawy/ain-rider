import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import "../src/auth/guards";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import {
  DriverGuard,
  JwtDriverGuard,
} from "../src/auth/guards/driver.guard";
import {
  JwtRiderGuard,
  RiderGuard,
} from "../src/auth/guards/rider.guard";
import { InternalAuthGuard } from "../src/auth/guards/internal-auth.guard";

function httpContext(headers: Record<string, string> = {}, user?: unknown) {
  const request: any = { headers, user };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any,
    request,
  };
}

describe("JwtAuthGuard", () => {
  it("rejects requests without an authorization header before touching passport", () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.canActivate(httpContext().context)).toThrow(
      new UnauthorizedException("No authorization header"),
    );
  });

  it("delegates to passport when an authorization header is present", () => {
    const guard = new JwtAuthGuard();
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const delegate = vi.spyOn(parent, "canActivate").mockReturnValue("ok" as any);

    const { context } = httpContext({ authorization: "Bearer token" });
    expect(guard.canActivate(context)).toBe("ok");
    expect(delegate).toHaveBeenCalled();
  });

  it("rethrows passport errors from handleRequest", () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(new Error("expired"), null, "info")).toThrow("expired");
  });

  it("rejects when no user was resolved", () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, null, "info")).toThrow(
      new UnauthorizedException("Authentication failed"),
    );
  });

  it("returns the resolved user", () => {
    const guard = new JwtAuthGuard();
    const user = { id: "u1" };
    expect(guard.handleRequest(null, user, "info")).toBe(user);
  });
});

describe.each([
  ["RiderGuard", RiderGuard, "RIDER", "riders"],
  ["DriverGuard", DriverGuard, "DRIVER", "drivers"],
])("%s", (_name, Guard, role, audience) => {
  const guard = new Guard();

  it(`allows authenticated ${audience}`, () => {
    const { context } = httpContext({}, { id: "u1", role });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects unauthenticated requests", () => {
    const { context } = httpContext({});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it(`rejects users that are not ${audience}`, () => {
    const { context } = httpContext({}, { id: "u1", role: "ADMIN" });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("exposes a passport jwt guard alias", () => {
    if (role === "RIDER") {
      expect(JwtRiderGuard).toBeDefined();
    } else {
      expect(JwtDriverGuard).toBeDefined();
    }
  });
});

describe("InternalAuthGuard", () => {
  const jwt = { verifyAsync: vi.fn() };
  const config = { get: vi.fn().mockReturnValue("secret") };
  const guard = new InternalAuthGuard(jwt as any, config as any);

  it("accepts a matching x-internal-secret header", async () => {
    const { context, request } = httpContext({ "x-internal-secret": "secret" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.service).toBe("internal");
  });

  it("rejects a mismatched x-internal-secret without an auth header", async () => {
    const { context } = httpContext({ "x-internal-secret": "wrong" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Internal service auth header missing"),
    );
  });

  it("rejects non-bearer authorization formats", async () => {
    const { context } = httpContext({ authorization: "Basic abc" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid internal service auth format"),
    );
  });

  it("rejects a bearer header without a token", async () => {
    const { context } = httpContext({ authorization: "Bearer" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid internal service auth format"),
    );
  });

  it("rejects tokens that fail verification", async () => {
    jwt.verifyAsync.mockRejectedValueOnce(new Error("jwt expired"));
    const { context } = httpContext({ authorization: "Bearer stale" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid internal service token"),
    );
    expect(jwt.verifyAsync).toHaveBeenCalledWith("stale", { secret: "secret" });
  });

  it("stringifies non-error verification failures when logging", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    jwt.verifyAsync.mockRejectedValueOnce("boom-not-an-error");
    const { context } = httpContext({ authorization: "Bearer stale" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid internal service token"),
    );
    expect(error).toHaveBeenCalledWith("[InternalAuthGuard] Error:", "boom-not-an-error");
  });

  it("rejects verified tokens without the internal claim", async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ internal: false });
    const { context } = httpContext({ authorization: "Bearer user-token" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException("Invalid internal service token"),
    );
  });

  it("accepts a valid internal token and attaches the service name", async () => {
    jwt.verifyAsync.mockResolvedValueOnce({ internal: true, service: "admin-service" });
    const { context, request } = httpContext({ authorization: "Bearer good" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.service).toBe("admin-service");
  });
});
