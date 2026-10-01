import { describe, expect, it, vi } from "vitest";
import { of } from "rxjs";
import { BadRequestException } from "@nestjs/common";
import { UnauthorizedError } from "@ain-rider/error-handling";
import { TraceInterceptor } from "../src/shared/interceptors/trace.interceptor";
import { GlobalExceptionFilter } from "../src/shared/filters/global-exception.filter";
import { handleNatsError } from "../src/shared/nats/nats-error.handler";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateImageFile,
} from "../src/shared/utils/file-upload.util";

describe("TraceInterceptor", () => {
  const interceptor = new TraceInterceptor();

  function httpContext(headers: Record<string, string>) {
    const request: any = { headers };
    return {
      context: {
        getType: () => "http",
        switchToHttp: () => ({ getRequest: () => request }),
      } as any,
      request,
    };
  }

  it("keeps an incoming X-Trace-Id on http requests", () => {
    const { context, request } = httpContext({ "X-Trace-Id": "incoming-1" });
    const next = { handle: vi.fn().mockReturnValue(of("ok")) };

    const result = interceptor.intercept(context, next as any);

    expect(request.traceId).toBe("incoming-1");
    expect(next.handle).toHaveBeenCalled();
    expect(result).toBe(next.handle.mock.results[0].value);
  });

  it("generates a trace id when the header is missing", () => {
    const { context, request } = httpContext({});
    interceptor.intercept(context, { handle: () => of("ok") } as any);
    expect(request.traceId).toEqual(expect.any(String));
  });

  it("reads the trace id from nats message headers on rpc", () => {
    const contextObj = {
      getHeaders: () => new Map([["X-Trace-Id", "nats-1"]]),
    };
    const context = {
      getType: () => "rpc",
      switchToRpc: () => ({ getContext: () => contextObj }),
    } as any;

    interceptor.intercept(context, { handle: () => of("ok") } as any);
    expect((contextObj as any).traceId).toBe("nats-1");
  });

  it("falls back to the rpc context trace id, then generates one", () => {
    const withId: any = { traceId: "ctx-1" };
    const withoutId: any = null;

    interceptor.intercept(
      { getType: () => "rpc", switchToRpc: () => ({ getContext: () => withId }) } as any,
      { handle: () => of("ok") } as any,
    );
    expect(withId.traceId).toBe("ctx-1");

    interceptor.intercept(
      { getType: () => "rpc", switchToRpc: () => ({ getContext: () => withoutId }) } as any,
      { handle: () => of("ok") } as any,
    );
  });

  it("passes other context types straight through", () => {
    const context = { getType: () => "ws" } as any;
    const next = { handle: vi.fn().mockReturnValue(of("ok")) };

    expect(interceptor.intercept(context, next as any)).toBeDefined();
    expect(next.handle).toHaveBeenCalled();
  });
});

describe("GlobalExceptionFilter", () => {
  const filter = new GlobalExceptionFilter();

  function httpHost(request: Record<string, unknown>) {
    const response = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    const host = {
      getType: () => "http",
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };
    return { host: host as any, response };
  }

  it("maps an HttpException to its AppError envelope", () => {
    const { host, response } = httpHost({
      traceId: "trace-1",
      url: "/auth/login",
      method: "POST",
    });

    filter.catch(new BadRequestException("bad input"), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
    );
  });

  it("normalizes unknown exceptions to a 500 envelope", () => {
    const { host, response } = httpHost({ url: "/x", method: "GET" });

    filter.catch(new Error("boom"), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: "INTERNAL_ERROR" }) }),
    );
  });

  it("returns the serialized error for rpc contexts", () => {
    const host = {
      getType: () => "rpc",
      switchToRpc: () => ({ getContext: () => ({ traceId: "rpc-1" }) }),
    } as any;

    const reply = filter.catch(new BadRequestException("nope"), host);
    expect(reply).toEqual(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) }),
    );
  });

  it("falls back to an unknown trace id for rpc contexts without headers", () => {
    const host = {
      getType: () => "rpc",
      switchToRpc: () => ({ getContext: () => null }),
    } as any;

    const reply = filter.catch(new BadRequestException("nope"), host);
    expect(reply).toEqual(
      expect.objectContaining({ success: false, error: expect.objectContaining({ traceId: "unknown" }) }),
    );
  });

  it("falls back for unknown context types", () => {
    const host = { getType: () => "ws" } as any;

    const reply = filter.catch(new Error("boom"), host);
    expect(reply).toEqual(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: "INTERNAL_ERROR" }) }),
    );
  });
});

describe("handleNatsError", () => {
  it("serializes an AppError with the trace id", () => {
    const body = JSON.parse(handleNatsError(new UnauthorizedError("nope"), "trace-9"));

    expect(body).toMatchObject({
      success: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED", message: "nope", traceId: "trace-9" }),
    });
  });
});

describe("validateImageFile", () => {
  it("accepts every allowed image mimetype under the size cap", () => {
    for (const mimetype of ALLOWED_IMAGE_MIME_TYPES) {
      expect(() => validateImageFile({ mimetype, size: 1024 })).not.toThrow();
    }
  });

  it("rejects disallowed mimetypes", () => {
    expect(() => validateImageFile({ mimetype: "video/mp4", size: 10 })).toThrow(
      "Invalid file type: video/mp4",
    );
  });

  it("rejects files above 10MB", () => {
    expect(() =>
      validateImageFile({ mimetype: "image/jpeg", size: MAX_FILE_SIZE_BYTES + 1 }),
    ).toThrow("File too large. Max size: 10MB");
  });
});
