import { Elysia, status } from "elysia";
import { AuthProxyService } from "./service";
import { AuthModel } from "./model";

const isProduction = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const SAME_SITE = isProduction ? "strict" : "lax";

const isMobileClient = (headers: Headers): boolean => {
  return headers.get("x-client-type") === "mobile";
};

console.log("[Auth Module] Configuration:", {
  isProduction,
  sameSite: SAME_SITE,
  secure: isProduction,
});

export const auth = new Elysia({ prefix: "/auth" })
  .post(
    "/login",
    async ({ body, cookie: { accessToken, refreshToken }, set, request }) => {
      const res = await AuthProxyService.login(body);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      const data = (await res.json()) as {
        user: unknown;
        accessToken: string;
        refreshToken: string;
      };

      accessToken.value = data.accessToken;
      accessToken.httpOnly = true;
      accessToken.secure = isProduction;
      accessToken.sameSite = SAME_SITE;
      accessToken.maxAge = ACCESS_TOKEN_MAX_AGE;
      accessToken.path = "/";

      refreshToken.value = data.refreshToken;
      refreshToken.httpOnly = true;
      refreshToken.secure = isProduction;
      refreshToken.sameSite = SAME_SITE;
      refreshToken.maxAge = REFRESH_TOKEN_MAX_AGE;
      refreshToken.path = "/";

      const responseBody: Record<string, unknown> = {
        user: data.user,
        success: true,
      };

      // Mobile clients need tokens in body
      if (isMobileClient(request.headers)) {
        responseBody.accessToken = data.accessToken;
        responseBody.refreshToken = data.refreshToken;
      }

      return responseBody;
    },
    { body: AuthModel.loginBody },
  )
  .post(
    "/register",
    async ({ body, cookie: { accessToken, refreshToken }, set, request }) => {
      const res = await AuthProxyService.register(body);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      const data = (await res.json()) as {
        user: unknown;
        accessToken: string;
        refreshToken: string;
      };

      accessToken.value = data.accessToken;
      accessToken.httpOnly = true;
      accessToken.secure = isProduction;
      accessToken.sameSite = SAME_SITE;
      accessToken.maxAge = ACCESS_TOKEN_MAX_AGE;
      accessToken.path = "/";

      refreshToken.value = data.refreshToken;
      refreshToken.httpOnly = true;
      refreshToken.secure = isProduction;
      refreshToken.sameSite = SAME_SITE;
      refreshToken.maxAge = REFRESH_TOKEN_MAX_AGE;
      refreshToken.path = "/";

      const responseBody: Record<string, unknown> = {
        user: data.user,
        success: true,
      };

      // Mobile clients need tokens in body
      if (isMobileClient(request.headers)) {
        responseBody.accessToken = data.accessToken;
        responseBody.refreshToken = data.refreshToken;
      }

      return responseBody;
    },
    { body: AuthModel.registerBody },
  )
  .post(
    "/refresh",
    async ({ cookie: { accessToken, refreshToken }, set, request }) => {
      // Resolve token: Bearer header first, then cookie fallback
      const authHeader = request.headers.get("authorization");
      let token: string;

      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else if (refreshToken.value) {
        token = refreshToken.value as string;
      } else {
        throw status(401, "No refresh token");
      }

      const res = await AuthProxyService.refresh(token);
      if (!res.ok) {
        refreshToken.remove();
        accessToken.remove();
        const errorBody = await res.text();
        set.status = res.status;
        return errorBody;
      }

      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
      };

      accessToken.value = data.accessToken;
      accessToken.httpOnly = true;
      accessToken.secure = isProduction;
      accessToken.sameSite = "strict";
      accessToken.maxAge = ACCESS_TOKEN_MAX_AGE;
      accessToken.path = "/";

      const responseBody: Record<string, unknown> = {
        success: true,
      };

      // Mobile clients need new tokens in body
      if (isMobileClient(request.headers)) {
        responseBody.accessToken = data.accessToken;
        if (data.refreshToken) {
          responseBody.refreshToken = data.refreshToken;
        }
      }

      return responseBody;
    },
  )
  /**
   * POST /auth/verify-otp
   *
   * Verifies a Firebase Phone Auth ID token and returns the verified phone number.
   * On success, publishes `ain_rider.otp_verified` NATS event for downstream services.
   *
   * Rate Limiting (FR-007):
   * - Global: 100 req/min per IP (configured in index.ts rateLimit middleware)
   * - OTP-specific (production): 10 req/min per IP, 5 req/hour per phone
   * - On limit exceeded: Returns HTTP 429 with Retry-After header
   *
   * Responses:
   * - 200: { success: true, phoneNumber: string, uid: string }
   * - 400: { success: false, error: { code: "VALIDATION_ERROR", message: string } }
   * - 401: { success: false, error: { code: "UNAUTHORIZED", message: string } }
   * - 429: { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: string } }
   * - 503: { success: false, error: { code: "SERVICE_UNAVAILABLE", message: string } }
   */
  .post(
    "/verify-otp",
    async ({ body, set }) => {
      const res = await AuthProxyService.verifyOtp(body as any);
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    },
    { body: AuthModel.verifyOtpBody },
  )
  .post("/logout", async ({ cookie: { accessToken, refreshToken } }) => {
    accessToken.remove();
    refreshToken.remove();
    return { success: true };
  })
  .get("/me", async ({ cookie: { accessToken }, request, set }) => {
    // Resolve token: Bearer header first, then cookie fallback
    const authHeader = request.headers.get("authorization");
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (accessToken?.value) {
      token = accessToken.value as string;
    }

    console.log("[/auth/me] Token resolution:", {
      source: authHeader?.startsWith("Bearer ")
        ? "bearer"
        : token
          ? "cookie"
          : "none",
      hasToken: !!token,
    });

    if (!token) {
      throw status(401, "Not authenticated");
    }

    const res = await AuthProxyService.getMe(token);
    if (!res.ok) {
      try {
        const errorBody = await res.json();
        set.status = res.status;
        return errorBody;
      } catch {
        set.status = res.status;
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to parse error response",
          },
        };
      }
    }

    return res.json();
  })
  .post(
    "/admin/create-user",
    async ({ body, cookie: { accessToken }, set }) => {
      if (!accessToken.value) {
        throw status(401, "Not authenticated");
      }

      const res = await AuthProxyService.adminCreateUser(
        accessToken.value as string,
        body,
      );
      if (!res.ok) {
        try {
          const errorBody = await res.json();
          set.status = res.status;
          return errorBody;
        } catch {
          set.status = res.status;
          return {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to parse error response",
            },
          };
        }
      }

      return res.json();
    },
    { body: AuthModel.adminCreateUserBody },
  );
